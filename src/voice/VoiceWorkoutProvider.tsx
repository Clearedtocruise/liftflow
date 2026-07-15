import * as Speech from 'expo-speech';
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import {
    rememberIosAudioSessionBeforeVoiceCapture,
    restoreIosAudioSessionAfterVoiceCapture,
    voiceCaptureIosCategory
} from '@/lib/iosAudioSession';
import { enrichParsedCommand, parseVoiceCommandLocal } from '@/lib/voice/parseVoiceCommand';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { voiceCoachingService } from '@/services/voiceCoachingService';
import { processVoiceTranscript } from '@/services/voiceService';

import { mapExtendedVoiceToWorkoutCommand, parseWorkoutCommand } from './parseWorkoutCommand';
import {
    loadPorcupineModule,
    resolveHeyOneMoreKeywordPath,
    wakeWordSetupHint,
    type PorcupineManagerStub,
} from './porcupineWakeWord';
import {
    attachSpeechListeners,
    loadSpeechRecognitionModule,
    speechRecognitionUnavailableMessage,
} from './speechRecognition';
import type {
    ParsedWorkoutCommand,
    VoiceWorkoutHandlers,
    VoiceWorkoutState,
} from './workoutCommandTypes';
import { executeWorkoutVoiceCommand } from './workoutVoiceApi';

type VoiceWorkoutContextValue = VoiceWorkoutState & {
  voiceScopeActive: boolean;
  setWorkoutScreenActive: (active: boolean) => void;
  setGymModeActive: (active: boolean) => void;
  wakePhraseSettingEnabled: boolean;
  setWakePhraseSettingEnabled: (enabled: boolean) => void;
  voiceFeedbackEnabled: boolean;
  setVoiceFeedbackEnabled: (enabled: boolean) => void;
  startWakeWord: () => Promise<void>;
  stopWakeWord: () => Promise<void>;
  startCommandListening: () => Promise<void>;
  stopCommandListening: () => Promise<void>;
  handleTranscript: (text: string) => Promise<void>;
  registerHandlers: (handlers: VoiceWorkoutHandlers | null) => void;
  setWorkoutContext: (context: {
    userId?: string;
    sessionId?: string;
    activeExerciseName?: string;
    activeExerciseId?: string;
    setNumber?: number;
    lastWeight?: number;
    lastReps?: number;
    preferredWeightUnit?: 'lb' | 'kg';
    authToken?: string;
  }) => void;
};

export const VoiceWorkoutContext = createContext<VoiceWorkoutContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  /** From user settings — coachingPreferences.wakePhraseEnabled */
  initialWakePhraseEnabled?: boolean;
  initialVoiceFeedback?: boolean;
};

const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY;

export function VoiceWorkoutProvider({
  children,
  initialWakePhraseEnabled = false,
  initialVoiceFeedback = true,
}: ProviderProps) {
  const porcupineRef = useRef<PorcupineManagerStub | null>(null);
  const handlersRef = useRef<VoiceWorkoutHandlers | null>(null);
  const handlingTranscriptRef = useRef(false);
  const commandListeningRef = useRef(false);
  const pendingTranscriptRef = useRef('');
  const interimFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakePhraseEnabledRef = useRef(initialWakePhraseEnabled);
  const voiceScopeActiveRef = useRef(false);
  const handleTranscriptRef = useRef<(text: string) => Promise<void>>(async () => {});
  const startWakeWordRef = useRef<() => Promise<void>>(async () => {});

  const workoutContextRef = useRef<{
    userId?: string;
    sessionId?: string;
    activeExerciseName?: string;
    activeExerciseId?: string;
    setNumber?: number;
    lastWeight?: number;
    lastReps?: number;
    preferredWeightUnit?: 'lb' | 'kg';
    authToken?: string;
  }>({});

  const [workoutScreenActive, setWorkoutScreenActive] = useState(false);
  const [gymModeActive, setGymModeActive] = useState(false);
  const voiceScopeActive = workoutScreenActive || gymModeActive;
  voiceScopeActiveRef.current = voiceScopeActive;
  const [wakePhraseSettingEnabled, setWakePhraseSettingEnabled] = useState(initialWakePhraseEnabled);
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(initialVoiceFeedback);

  const [state, setState] = useState<VoiceWorkoutState>({
    wakeWordEnabled: false,
    listeningForWakeWord: false,
    listeningForCommand: false,
    transcript: '',
  });

  useEffect(() => {
    setWakePhraseSettingEnabled(initialWakePhraseEnabled);
    wakePhraseEnabledRef.current = initialWakePhraseEnabled;
  }, [initialWakePhraseEnabled]);

  useEffect(() => {
    setVoiceFeedbackEnabled(initialVoiceFeedback);
  }, [initialVoiceFeedback]);

  const speak = useCallback(
    (message: string) => {
      if (!voiceFeedbackEnabled || Platform.OS === 'web') return;
      void voiceCoachingService.speakLine(message);
    },
    [voiceFeedbackEnabled],
  );

  const registerHandlers = useCallback((handlers: VoiceWorkoutHandlers | null) => {
    handlersRef.current = handlers;
  }, []);

  const setWorkoutContext = useCallback(
    (context: {
      userId?: string;
      sessionId?: string;
      activeExerciseName?: string;
      activeExerciseId?: string;
      setNumber?: number;
      lastWeight?: number;
      lastReps?: number;
      preferredWeightUnit?: 'lb' | 'kg';
      authToken?: string;
    }) => {
      workoutContextRef.current = context;
    },
    [],
  );

  const stopCommandListening = useCallback(async () => {
    if (interimFinalizeTimerRef.current) {
      clearTimeout(interimFinalizeTimerRef.current);
      interimFinalizeTimerRef.current = null;
    }
    commandListeningRef.current = false;
    const speech = loadSpeechRecognitionModule();
    if (speech) {
      try {
        await speech.ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.warn('[voice] stop speech failed', error);
      }
    }
    restoreIosAudioSessionAfterVoiceCapture();
    setState((prev) => ({ ...prev, listeningForCommand: false }));
    if (voiceScopeActiveRef.current && wakePhraseEnabledRef.current) {
      void startWakeWordRef.current();
    }
  }, []);

  const parseTranscript = useCallback(async (text: string): Promise<ParsedWorkoutCommand> => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { intent: 'UNKNOWN', rawText: text, confidence: 0 };
    }

    const ctx = workoutContextRef.current;
    const voiceContext = {
      activeExerciseName: ctx.activeExerciseName,
      lastWeight: ctx.lastWeight,
      lastReps: ctx.lastReps,
      preferredWeightUnit: ctx.preferredWeightUnit,
      setNumber: ctx.setNumber,
    };
    const localOnly = workoutScreenActive || gymModeActive;
    const minConfidence = localOnly ? 0.65 : 0.7;

    const extendedLocal = parseVoiceCommandLocal(trimmed, voiceContext);
    if (extendedLocal) {
      const mapped = mapExtendedVoiceToWorkoutCommand(
        enrichParsedCommand(extendedLocal, voiceContext),
      );
      if (mapped.intent !== 'UNKNOWN' && mapped.confidence >= minConfidence) {
        return mapped;
      }
    }

    const local = parseWorkoutCommand(trimmed, { activeExerciseName: ctx.activeExerciseName });
    if (local.intent !== 'UNKNOWN' && local.confidence >= (localOnly ? 0.65 : 0.8)) {
      return local;
    }

    if (!localOnly && ctx.userId) {
      const result = await processVoiceTranscript(ctx.userId, {
        transcript: trimmed,
        context: voiceContext,
      });
      if (result.success) {
        return mapExtendedVoiceToWorkoutCommand(result.data.parsed);
      }
    }

    return local.intent !== 'UNKNOWN' ? local : parseWorkoutCommand(trimmed, { activeExerciseName: ctx.activeExerciseName });
  }, [workoutScreenActive, gymModeActive]);

  const handleTranscript = useCallback(
    async (text: string) => {
      if (handlingTranscriptRef.current) return;
      handlingTranscriptRef.current = true;

      try {
        const parsedCommand = await parseTranscript(text);

        setState((prev) => ({
          ...prev,
          transcript: text,
          lastCommand: parsedCommand,
          listeningForCommand: false,
          error: undefined,
        }));

        await stopCommandListening();

        if (parsedCommand.intent === 'UNKNOWN') {
          speak('I did not understand that. Please try again.');
          return;
        }

        if (parsedCommand.intent === 'CANCEL') {
          speak('Cancelled.');
          return;
        }

        const handlers = handlersRef.current;
        if (!handlers) {
          speak('No active workout found.');
          setState((prev) => ({ ...prev, error: 'No active workout handlers registered.' }));
          return;
        }

        const result = await executeWorkoutVoiceCommand({ command: parsedCommand, handlers });

        if (!result.success) {
          setState((prev) => ({ ...prev, error: result.message }));
          speak(result.message);
          return;
        }

        const userId = workoutContextRef.current.userId;
        if (userId && (parsedCommand.intent === 'LOG_SET' || parsedCommand.intent === 'LOG_BODYWEIGHT_SET')) {
          void productAnalyticsService.trackVoiceLog(userId, parsedCommand.intent);
        }

        if (parsedCommand.intent === 'LOG_SET' && parsedCommand.exerciseName && parsedCommand.reps != null) {
          const unitLabel = parsedCommand.unit === 'kg' ? 'kilograms' : 'pounds';
          const weightPart =
            parsedCommand.weight != null ? `${parsedCommand.weight} ${unitLabel} ` : '';
          speak(`Logged ${parsedCommand.exerciseName}, ${weightPart}for ${parsedCommand.reps} reps.`);
        } else if (
          parsedCommand.intent === 'LOG_BODYWEIGHT_SET' &&
          parsedCommand.exerciseName &&
          parsedCommand.reps != null
        ) {
          speak(`Logged ${parsedCommand.exerciseName} for ${parsedCommand.reps} reps.`);
        } else if (parsedCommand.intent === 'START_REST_TIMER') {
          speak(`Started rest timer for ${parsedCommand.durationSeconds ?? 90} seconds.`);
        } else if (parsedCommand.intent === 'UNDO_LAST_SET') {
          speak(result.message);
        } else {
          speak(result.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Voice command failed';
        console.warn('[voice] handleTranscript failed', message);
        setState((prev) => ({ ...prev, error: message }));
        speak('I could not save that. Please try again.');
      } finally {
        handlingTranscriptRef.current = false;
        commandListeningRef.current = false;
      }
    },
    [parseTranscript, speak, stopCommandListening],
  );

  useEffect(() => {
    handleTranscriptRef.current = handleTranscript;
  }, [handleTranscript]);

  const startCommandListening = useCallback(async () => {
    const speech = loadSpeechRecognitionModule();
    if (!speech) {
      const message = speechRecognitionUnavailableMessage();
      setState((prev) => ({ ...prev, error: message }));
      speak('Voice logging is not available right now.');
      return;
    }

    try {
      if (porcupineRef.current) {
        try {
          await porcupineRef.current.stop();
        } catch {
          // Mic handoff — wake word resumes after command listening ends.
        }
      }

      if (commandListeningRef.current) {
        handlingTranscriptRef.current = false;
        try {
          await speech.ExpoSpeechRecognitionModule.stop();
        } catch {
          speech.ExpoSpeechRecognitionModule.abort?.();
        }
        commandListeningRef.current = false;
      }

      const permissions = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        setState((prev) => ({
          ...prev,
          error: 'Speech recognition permission denied',
        }));
        speak('Microphone permission is required.');
        return;
      }

      commandListeningRef.current = true;
      pendingTranscriptRef.current = '';
      if (interimFinalizeTimerRef.current) {
        clearTimeout(interimFinalizeTimerRef.current);
        interimFinalizeTimerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        listeningForCommand: true,
        transcript: '',
        error: undefined,
      }));

      rememberIosAudioSessionBeforeVoiceCapture();
      await speech.ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        maxAlternatives: 3,
        // Cloud recognition is more reliable in gyms; on-device often fails silently.
        requiresOnDeviceRecognition: false,
        iosCategory: voiceCaptureIosCategory(),
      });
    } catch (error) {
      commandListeningRef.current = false;
      restoreIosAudioSessionAfterVoiceCapture();
      const message = error instanceof Error ? error.message : 'Failed to start command listening';
      console.warn('[voice] startCommandListening failed', message);
      setState((prev) => ({
        ...prev,
        listeningForCommand: false,
        error: message,
      }));
      speak('Voice logging is not available right now.');
    }
  }, [speak]);

  const onWakeWordDetected = useCallback(() => {
    if (commandListeningRef.current) return;
    setState((prev) => ({
      ...prev,
      listeningForWakeWord: true,
      error: undefined,
    }));
    void startCommandListening();
  }, [startCommandListening]);

  const startWakeWord = useCallback(async () => {
    if (!wakePhraseSettingEnabled) return;

    try {
      if (!PICOVOICE_ACCESS_KEY) {
        throw new Error('Missing EXPO_PUBLIC_PICOVOICE_ACCESS_KEY');
      }

      const porcupine = loadPorcupineModule();
      const keywordPath = resolveHeyOneMoreKeywordPath();
      if (!porcupine || !keywordPath) {
        throw new Error(wakeWordSetupHint());
      }

      if (!porcupineRef.current) {
        const manager = await porcupine.PorcupineManager.fromKeywordPaths(
          PICOVOICE_ACCESS_KEY,
          [keywordPath],
          () => {
            onWakeWordDetected();
          },
          (error) => {
            console.warn('[voice] porcupine error', error);
          },
        );
        porcupineRef.current = manager;
      }

      await porcupineRef.current.start();

      setState((prev) => ({
        ...prev,
        wakeWordEnabled: true,
        listeningForWakeWord: true,
        error: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start Hey OneMore';
      console.warn('[voice] startWakeWord failed', message);
      setState((prev) => ({
        ...prev,
        wakeWordEnabled: false,
        listeningForWakeWord: false,
        error: message,
      }));
    }
  }, [onWakeWordDetected, wakePhraseSettingEnabled]);

  useEffect(() => {
    startWakeWordRef.current = startWakeWord;
  }, [startWakeWord]);

  const stopWakeWord = useCallback(async () => {
    try {
      if (porcupineRef.current) {
        await porcupineRef.current.stop();
      }
      setState((prev) => ({
        ...prev,
        wakeWordEnabled: false,
        listeningForWakeWord: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop Hey OneMore';
      console.warn('[voice] stopWakeWord failed', message);
      setState((prev) => ({ ...prev, error: message }));
    }
  }, []);

  useEffect(() => {
    const speech = loadSpeechRecognitionModule();
    if (!speech) return;

    return attachSpeechListeners(speech, {
      onResult: (transcript, isFinal) => {
        pendingTranscriptRef.current = transcript;
        if (isFinal) {
          if (interimFinalizeTimerRef.current) {
            clearTimeout(interimFinalizeTimerRef.current);
            interimFinalizeTimerRef.current = null;
          }
          pendingTranscriptRef.current = '';
          void handleTranscriptRef.current(transcript);
          return;
        }

        setState((prev) => ({
          ...prev,
          transcript,
          listeningForCommand: true,
        }));

        if (interimFinalizeTimerRef.current) {
          clearTimeout(interimFinalizeTimerRef.current);
        }
        interimFinalizeTimerRef.current = setTimeout(() => {
          interimFinalizeTimerRef.current = null;
          const pending = pendingTranscriptRef.current.trim();
          if (!pending || handlingTranscriptRef.current) return;
          pendingTranscriptRef.current = '';
          void handleTranscriptRef.current(pending);
        }, 1800);
      },
      onError: (message) => {
        console.warn('[voice] speech error', message);
        if (interimFinalizeTimerRef.current) {
          clearTimeout(interimFinalizeTimerRef.current);
          interimFinalizeTimerRef.current = null;
        }
        commandListeningRef.current = false;
        pendingTranscriptRef.current = '';
        restoreIosAudioSessionAfterVoiceCapture();
        setState((prev) => ({
          ...prev,
          listeningForCommand: false,
          error: message,
        }));
        speak('I did not catch that. Tap the mic and try again.');
        if (voiceScopeActiveRef.current && wakePhraseEnabledRef.current) {
          void startWakeWordRef.current();
        }
      },
      onEnd: () => {
        if (interimFinalizeTimerRef.current) {
          clearTimeout(interimFinalizeTimerRef.current);
          interimFinalizeTimerRef.current = null;
        }

        const pending = pendingTranscriptRef.current.trim();
        if (pending && !handlingTranscriptRef.current) {
          pendingTranscriptRef.current = '';
          void handleTranscriptRef.current(pending);
          return;
        }

        restoreIosAudioSessionAfterVoiceCapture();
        setState((prev) => ({
          ...prev,
          listeningForCommand: false,
        }));
        commandListeningRef.current = false;
        if (voiceScopeActiveRef.current && wakePhraseEnabledRef.current) {
          void startWakeWordRef.current();
        }
      },
    });
  }, [speak]);

  useEffect(() => {
    if (voiceScopeActive && wakePhraseSettingEnabled) {
      void startWakeWord();
    } else {
      void stopWakeWord();
    }
  }, [voiceScopeActive, wakePhraseSettingEnabled, startWakeWord, stopWakeWord]);

  useEffect(() => {
    if (!voiceScopeActive) return;
    return () => {
      void stopCommandListening();
    };
  }, [voiceScopeActive, stopCommandListening]);

  useEffect(() => {
    return () => {
      void stopCommandListening();
      porcupineRef.current?.delete?.().catch(() => undefined);
      restoreIosAudioSessionAfterVoiceCapture();
      Speech.stop();
    };
  }, [stopCommandListening]);

  const value = useMemo<VoiceWorkoutContextValue>(
    () => ({
      ...state,
      voiceScopeActive,
      setWorkoutScreenActive,
      setGymModeActive,
      wakePhraseSettingEnabled,
      setWakePhraseSettingEnabled,
      voiceFeedbackEnabled,
      setVoiceFeedbackEnabled,
      startWakeWord,
      stopWakeWord,
      startCommandListening,
      stopCommandListening,
      handleTranscript,
      registerHandlers,
      setWorkoutContext,
    }),
    [
      state,
      voiceScopeActive,
      wakePhraseSettingEnabled,
      voiceFeedbackEnabled,
      startWakeWord,
      stopWakeWord,
      startCommandListening,
      stopCommandListening,
      handleTranscript,
      registerHandlers,
      setWorkoutContext,
    ],
  );

  return <VoiceWorkoutContext.Provider value={value}>{children}</VoiceWorkoutContext.Provider>;
}

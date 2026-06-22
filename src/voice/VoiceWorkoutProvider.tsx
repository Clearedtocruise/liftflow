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

import { productAnalyticsService } from '@/services/productAnalyticsService';
import { processVoiceTranscript } from '@/services/voiceService';

import { mapExtendedVoiceToWorkoutCommand, parseWorkoutCommand } from './parseWorkoutCommand';
import {
    loadPorcupineModule,
    resolveHeyOneMoreKeywordPath,
    wakeWordSetupHint,
    type PorcupineModule,
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
  const porcupineRef = useRef<InstanceType<PorcupineModule['PorcupineManager']> | null>(null);
  const handlersRef = useRef<VoiceWorkoutHandlers | null>(null);
  const handlingTranscriptRef = useRef(false);
  const commandListeningRef = useRef(false);

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
  }, [initialWakePhraseEnabled]);

  useEffect(() => {
    setVoiceFeedbackEnabled(initialVoiceFeedback);
  }, [initialVoiceFeedback]);

  const speak = useCallback(
    (message: string) => {
      if (!voiceFeedbackEnabled || Platform.OS === 'web') return;
      Speech.stop();
      Speech.speak(message, { language: 'en-US', rate: 0.95, pitch: 1 });
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
    commandListeningRef.current = false;
    const speech = loadSpeechRecognitionModule();
    if (speech) {
      try {
        await speech.ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.warn('[voice] stop speech failed', error);
      }
    }
    setState((prev) => ({ ...prev, listeningForCommand: false }));
  }, []);

  const parseTranscript = useCallback(async (text: string): Promise<ParsedWorkoutCommand> => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { intent: 'UNKNOWN', rawText: text, confidence: 0 };
    }

    const ctx = workoutContextRef.current;
    const local = parseWorkoutCommand(trimmed);
    if (local.intent !== 'UNKNOWN' && local.confidence >= 0.8) {
      return local;
    }

    if (ctx.userId) {
      const result = await processVoiceTranscript(ctx.userId, {
        transcript: trimmed,
        context: {
          activeExerciseName: ctx.activeExerciseName,
          lastWeight: ctx.lastWeight,
          lastReps: ctx.lastReps,
          preferredWeightUnit: ctx.preferredWeightUnit,
          setNumber: ctx.setNumber,
        },
      });
      if (result.success) {
        return mapExtendedVoiceToWorkoutCommand(result.data.parsed);
      }
    }

    return local.intent !== 'UNKNOWN' ? local : parseWorkoutCommand(trimmed);
  }, []);

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

  const startCommandListening = useCallback(async () => {
    if (commandListeningRef.current) return;

    const speech = loadSpeechRecognitionModule();
    if (!speech) {
      const message = speechRecognitionUnavailableMessage();
      setState((prev) => ({ ...prev, error: message }));
      speak('Voice logging is not available right now.');
      return;
    }

    try {
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
      setState((prev) => ({
        ...prev,
        listeningForCommand: true,
        transcript: '',
        error: undefined,
      }));

      speak('Listening.');

      await speech.ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      commandListeningRef.current = false;
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
        if (!isFinal || !commandListeningRef.current) return;
        void handleTranscript(transcript);
      },
      onError: (message) => {
        console.warn('[voice] speech error', message);
        commandListeningRef.current = false;
        setState((prev) => ({
          ...prev,
          listeningForCommand: false,
          error: message,
        }));
        speak('I did not catch that.');
      },
      onEnd: () => {
        commandListeningRef.current = false;
        setState((prev) => ({ ...prev, listeningForCommand: false }));
      },
    });
  }, [handleTranscript, speak]);

  useEffect(() => {
    const shouldListen = voiceScopeActive && wakePhraseSettingEnabled;
    if (shouldListen) {
      void startWakeWord();
    } else {
      void stopWakeWord();
      void stopCommandListening();
    }

    return () => {
      void stopWakeWord();
      void stopCommandListening();
    };
  }, [voiceScopeActive, wakePhraseSettingEnabled, startWakeWord, stopWakeWord, stopCommandListening]);

  useEffect(() => {
    return () => {
      void stopCommandListening();
      porcupineRef.current?.delete?.().catch(() => undefined);
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

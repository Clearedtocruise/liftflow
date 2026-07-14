import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { VoiceInputMode } from '@/types/voice';

type SpeechResultEvent = { results?: { transcript?: string }[]; isFinal?: boolean };
type SpeechErrorEvent = { message?: string };

type SpeechModule = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    start(opts: { lang: string; interimResults: boolean; continuous: boolean }): void;
    stop(): void;
    abort?(): void;
    addListener(event: string, cb: (event: unknown) => void): { remove(): void };
  };
};

function loadSpeechModule(): SpeechModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as SpeechModule;
  } catch {
    return null;
  }
}

const EXPO_GO_MESSAGE = 'Voice logging requires a development build (not Expo Go).';

export type VoiceRecognitionOptions = {
  /** Mic only active when true — e.g. during active workout (battery) */
  enabled?: boolean;
  inputMode?: VoiceInputMode;
  /** Called when a final utterance is ready to parse */
  onFinalTranscript?: (text: string) => void;
  lang?: string;
};

export function useVoiceRecognition(options: VoiceRecognitionOptions = {}) {
  const { enabled = true, inputMode = 'push_to_talk', onFinalTranscript, lang = 'en-US' } = options;

  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const onFinalRef = useRef(onFinalTranscript);
  const inputModeRef = useRef(inputMode);
  const enabledRef = useRef(enabled);

  onFinalRef.current = onFinalTranscript;
  inputModeRef.current = inputMode;
  enabledRef.current = enabled;

  useEffect(() => {
    setIsAvailable(loadSpeechModule() != null && Platform.OS !== 'web');
  }, []);

  useEffect(() => {
    const speech = loadSpeechModule();
    if (!speech) return;

    const mod = speech.ExpoSpeechRecognitionModule;
    const resultSub = mod.addListener('result', (event) => {
      const ev = event as SpeechResultEvent;
      const text = ev.results?.[0]?.transcript ?? '';
      if (!text) return;
      setInterimTranscript(text);
      transcriptRef.current = text;
      if (ev.isFinal !== false) {
        setFinalTranscript(text);
      }
    });
    const endSub = mod.addListener('end', () => {
      setIsListening(false);
      const text = transcriptRef.current.trim();
      if (text && inputModeRef.current !== 'continuous') {
        onFinalRef.current?.(text);
      }
    });
    const errorSub = mod.addListener('error', (event) => {
      setError((event as SpeechErrorEvent).message ?? 'Speech recognition error');
      setIsListening(false);
    });

    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!enabledRef.current) return false;

    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
    transcriptRef.current = '';

    if (Platform.OS === 'web') {
      setError('Voice logging requires iOS or Android');
      return false;
    }

    const speech = loadSpeechModule();
    if (!speech) {
      setError(EXPO_GO_MESSAGE);
      Alert.alert('Development build required', EXPO_GO_MESSAGE);
      return false;
    }

    const permission = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone required', 'Enable microphone access to log sets by voice.');
      return false;
    }

    speech.ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: inputModeRef.current === 'continuous',
    });
    setIsListening(true);
    return true;
  }, [lang]);

  const stopListening = useCallback(() => {
    const speech = loadSpeechModule();
    speech?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    const text = transcriptRef.current.trim();
    if (text) {
      onFinalRef.current?.(text);
    }
  }, []);

  const abortListening = useCallback(() => {
    const speech = loadSpeechModule();
    speech?.ExpoSpeechRecognitionModule.abort?.();
    speech?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    setInterimTranscript('');
    transcriptRef.current = '';
  }, []);

  const clearTranscript = useCallback(() => {
    setInterimTranscript('');
    setFinalTranscript('');
    setError(null);
    transcriptRef.current = '';
  }, []);

  /** Push-to-talk: press in starts, press out stops + processes */
  const handlePressIn = useCallback(async () => {
    if (inputModeRef.current !== 'push_to_talk') return;
    if (isListening) return;
    await startListening();
  }, [isListening, startListening]);

  const handlePressOut = useCallback(() => {
    if (inputModeRef.current !== 'push_to_talk') return;
    if (isListening) stopListening();
  }, [isListening, stopListening]);

  /** Tap toggle for tap_toggle and continuous modes */
  const handleTogglePress = useCallback(async () => {
    if (inputModeRef.current === 'push_to_talk') return;
    if (isListening) stopListening();
    else await startListening();
  }, [isListening, startListening, stopListening]);

  const handleMicPress = useCallback(async () => {
    if (inputModeRef.current === 'push_to_talk') return;
    await handleTogglePress();
  }, [handleTogglePress]);

  return {
    isAvailable,
    isListening,
    interimTranscript,
    finalTranscript,
    transcript: interimTranscript || finalTranscript,
    transcriptRef,
    error,
    inputMode,
    startListening,
    stopListening,
    abortListening,
    clearTranscript,
    handlePressIn,
    handlePressOut,
    handleMicPress,
  };
}

/** Simple tap-to-toggle STT for nutrition/coach screens */
export function useVoiceLogging() {
  return useVoiceRecognition({ inputMode: 'tap_toggle' });
}

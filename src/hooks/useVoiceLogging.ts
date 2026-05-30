import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

type SpeechResultEvent = { results?: { transcript?: string }[] };
type SpeechErrorEvent = { message?: string };

type SpeechModule = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    start(opts: { lang: string; interimResults: boolean; continuous: boolean }): void;
    stop(): void;
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

export function useVoiceLogging() {
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const speech = loadSpeechModule();
    if (!speech) return;

    const mod = speech.ExpoSpeechRecognitionModule;
    const resultSub = mod.addListener('result', (event) => {
      const text = (event as SpeechResultEvent).results?.[0]?.transcript;
      if (text) {
        setTranscript(text);
        transcriptRef.current = text;
      }
    });
    const endSub = mod.addListener('end', () => {
      setIsListening(false);
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
    setError(null);
    setTranscript('');

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
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    });
    setIsListening(true);
    return true;
  }, []);

  const stopListening = useCallback(() => {
    const speech = loadSpeechModule();
    speech?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    transcriptRef,
    isListening,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}

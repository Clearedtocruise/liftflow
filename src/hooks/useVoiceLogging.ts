import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

export function useVoiceLogging() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript;
    if (text) setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.message ?? 'Speech recognition error');
    setIsListening(false);
  });

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');

    if (Platform.OS === 'web') {
      setError('Voice logging requires iOS or Android');
      return false;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone required', 'Enable microphone access to log sets by voice.');
      return false;
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    });
    setIsListening(true);
    return true;
  }, []);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}

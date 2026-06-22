import { Platform } from 'react-native';

type SpeechResultEvent = { results?: { transcript?: string }[]; isFinal?: boolean };
type SpeechErrorEvent = { error?: string; message?: string };

export type SpeechRecognitionModule = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    start(opts: {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      maxAlternatives?: number;
      requiresOnDeviceRecognition?: boolean;
    }): void;
    stop(): Promise<void> | void;
    abort?(): void;
    isRecognitionAvailable?(): boolean;
    addListener(event: string, cb: (event: unknown) => void): { remove(): void };
  };
  useSpeechRecognitionEvent?: (
    event: string,
    listener: (event: unknown) => void,
  ) => void;
};

export function loadSpeechRecognitionModule(): SpeechRecognitionModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as SpeechRecognitionModule;
  } catch {
    return null;
  }
}

export function speechRecognitionUnavailableMessage(): string {
  return 'Voice logging requires a ONE MORE dev build (not Expo Go). Rebuild after installing expo-speech-recognition.';
}

export type SpeechListenerCleanup = () => void;

export function attachSpeechListeners(
  module: SpeechRecognitionModule,
  handlers: {
    onResult: (transcript: string, isFinal: boolean) => void;
    onError: (message: string) => void;
    onEnd: () => void;
  },
): SpeechListenerCleanup {
  const mod = module.ExpoSpeechRecognitionModule;

  const resultSub = mod.addListener('result', (event) => {
    const ev = event as SpeechResultEvent;
    const transcript = ev.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    handlers.onResult(transcript, ev.isFinal !== false);
  });

  const errorSub = mod.addListener('error', (event) => {
    const ev = event as SpeechErrorEvent;
    handlers.onError(ev.message ?? ev.error ?? 'Speech recognition error');
  });

  const endSub = mod.addListener('end', () => {
    handlers.onEnd();
  });

  return () => {
    resultSub.remove();
    errorSub.remove();
    endSub.remove();
  };
}

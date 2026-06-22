import { Platform } from 'react-native';

/** iOS custom wake word — train "Hey OneMore" in Picovoice Console and add the .ppn here. */
export const HEY_ONEMORE_KEYWORD_BASENAME = 'hey_onemore_ios.ppn';

/** Stub until @picovoice/porcupine-react-native is linked in a future native build. */
export type PorcupineManagerStub = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  delete: () => Promise<void>;
};

export type PorcupineModule = {
  PorcupineManager: {
    fromKeywordPaths: (
      accessKey: string,
      keywordPaths: string[],
      onWakeWord: (keywordIndex: number) => void,
      onError?: (error: unknown) => void,
    ) => Promise<PorcupineManagerStub>;
  };
};

/** Wake word native module not bundled in TestFlight builds yet — tap-to-voice still works. */
export function loadPorcupineModule(): PorcupineModule | null {
  return null;
}

export function resolveHeyOneMoreKeywordPath(): string | null {
  if (Platform.OS === 'ios') {
    return HEY_ONEMORE_KEYWORD_BASENAME;
  }
  if (Platform.OS === 'android') {
    return 'hey_onemore_android.ppn';
  }
  return null;
}

export function wakeWordSetupHint(): string {
  return (
    'Hey OneMore wake word requires a future app update with Picovoice native modules. ' +
    'Use the mic button or enable Gym Mode for tap-to-voice logging now.'
  );
}

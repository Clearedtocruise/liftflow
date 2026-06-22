import { Platform } from 'react-native';

import type { PorcupineManager } from '@picovoice/porcupine-react-native';

/** iOS custom wake word — train "Hey OneMore" in Picovoice Console and add the .ppn here. */
export const HEY_ONEMORE_KEYWORD_BASENAME = 'hey_onemore_ios.ppn';

export type PorcupineModule = {
  PorcupineManager: typeof PorcupineManager;
};

export function loadPorcupineModule(): PorcupineModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@picovoice/porcupine-react-native') as PorcupineModule;
  } catch {
    return null;
  }
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
    'Add a custom Picovoice keyword file (hey_onemore_ios.ppn) to the native app bundle and set EXPO_PUBLIC_PICOVOICE_ACCESS_KEY. ' +
    'Tap-to-voice still works without wake word.'
  );
}

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import type { SpeechOptions } from 'expo-speech';

type IosAudioSessionSnapshot = {
  category: string;
  categoryOptions: string[];
  mode: string;
};

type SpeechRecognitionIosModule = {
  getAudioSessionCategoryAndOptionsIOS?: () => IosAudioSessionSnapshot;
  setCategoryIOS?: (options: {
    category: string;
    categoryOptions: string[];
    mode?: string;
  }) => void;
  setAudioSessionActiveIOS?: (
    value: boolean,
    options?: { notifyOthersOnDeactivation: boolean },
  ) => void;
};

let preCaptureSnapshot: IosAudioSessionSnapshot | null = null;

function loadSpeechRecognitionIosModule(): SpeechRecognitionIosModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: SpeechRecognitionIosModule;
    };
    return mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

function loadVoiceCaptureCategory() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    AVAudioSessionCategory,
    AVAudioSessionCategoryOptions,
    AVAudioSessionMode,
  } = require('expo-speech-recognition') as {
    AVAudioSessionCategory: { playAndRecord: string };
    AVAudioSessionCategoryOptions: {
      duckOthers: string;
      mixWithOthers: string;
      defaultToSpeaker: string;
      allowBluetooth: string;
    };
    AVAudioSessionMode: { default: string };
  };

  return {
    category: AVAudioSessionCategory.playAndRecord,
    categoryOptions: [
      AVAudioSessionCategoryOptions.duckOthers,
      AVAudioSessionCategoryOptions.mixWithOthers,
      AVAudioSessionCategoryOptions.defaultToSpeaker,
      AVAudioSessionCategoryOptions.allowBluetooth,
    ],
    mode: AVAudioSessionMode.default,
  };
}

/** iOS speech-recognition category: duck background music instead of stopping it. */
export function voiceCaptureIosCategory() {
  return loadVoiceCaptureCategory();
}

/** Snapshot the active session before voice capture changes it. */
export function rememberIosAudioSessionBeforeVoiceCapture(): void {
  const mod = loadSpeechRecognitionIosModule();
  if (!mod?.getAudioSessionCategoryAndOptionsIOS || preCaptureSnapshot) return;
  preCaptureSnapshot = mod.getAudioSessionCategoryAndOptionsIOS();
}

/** Return music to its pre-capture level after voice logging ends. */
export function restoreIosAudioSessionAfterVoiceCapture(): void {
  const mod = loadSpeechRecognitionIosModule();
  if (!mod) return;

  if (preCaptureSnapshot && mod.setCategoryIOS) {
    mod.setCategoryIOS({
      category: preCaptureSnapshot.category,
      categoryOptions: preCaptureSnapshot.categoryOptions,
      mode: preCaptureSnapshot.mode,
    });
  }

  mod.setAudioSessionActiveIOS?.(false, { notifyOthersOnDeactivation: true });
  preCaptureSnapshot = null;
}

const IOS_DUCKED_SPEECH_OPTIONS: Pick<SpeechOptions, 'useApplicationAudioSession'> = {
  useApplicationAudioSession: false,
};

/** Speak short coaching cues while ducking (not stopping) background music on iOS. */
export function speakWithMusicDuck(text: string, options?: SpeechOptions): void {
  if (Platform.OS === 'web') return;

  const { onDone, onError, onStopped, ...rest } = options ?? {};
  Speech.stop();
  Speech.speak(text, {
    language: 'en-US',
    ...rest,
    ...(Platform.OS === 'ios' ? IOS_DUCKED_SPEECH_OPTIONS : null),
    onDone: () => {
      onDone?.();
    },
    onError: (error) => {
      onError?.(error);
    },
    onStopped: () => {
      onStopped?.();
    },
  });
}

import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';

export function cueRestTimerComplete(options?: { sound?: boolean; haptics?: boolean }): void {
  if (Platform.OS === 'web') return;

  const sound = options?.sound ?? true;
  const haptics = options?.haptics ?? true;

  if (haptics) {
    Vibration.vibrate([0, 200, 100, 200, 100, 200]);
  }

  if (sound) {
    Speech.stop();
    Speech.speak('Rest complete', { rate: 1.05, pitch: 1 });
  }
}

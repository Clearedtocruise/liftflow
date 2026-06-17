import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';

import type { IntervalPhase } from '@/lib/timerEngine';

export function cueIntervalPhase(phase: IntervalPhase, options?: { speak?: boolean }): void {
  if (Platform.OS === 'web') return;
  const speak = options?.speak ?? false;

  if (phase === 'work') {
    Vibration.vibrate([0, 120, 60, 120]);
    if (speak) {
      Speech.stop();
      Speech.speak('Work', { rate: 1.1, pitch: 1.05 });
    }
    return;
  }

  if (phase === 'rest') {
    Vibration.vibrate([0, 80, 40, 80]);
    if (speak) {
      Speech.stop();
      Speech.speak('Rest', { rate: 1.05, pitch: 1 });
    }
    return;
  }

  if (phase === 'done') {
    Vibration.vibrate([0, 200, 100, 200, 100, 200]);
    if (speak) {
      Speech.stop();
      Speech.speak('Complete', { rate: 1, pitch: 1 });
    }
  }
}

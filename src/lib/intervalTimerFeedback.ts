import * as Speech from 'expo-speech';
import { Platform, Vibration } from 'react-native';

import type { IntervalPhase } from '@/lib/timerEngine';

const PHASE_CUES: Record<IntervalPhase, { pattern: number[]; words: string; rate: number; pitch: number }> = {
  work: { pattern: [0, 120, 60, 120], words: 'Work', rate: 1.1, pitch: 1.05 },
  rest: { pattern: [0, 80, 40, 80], words: 'Rest', rate: 1.05, pitch: 1 },
  done: { pattern: [0, 200, 100, 200, 100, 200], words: 'Complete', rate: 1, pitch: 1 },
};

// iOS ignores vibration patterns entirely, so it gets a single buzz instead of a silent no-op.
function buzz(pattern: number[]): void {
  if (Platform.OS === 'ios') Vibration.vibrate();
  else Vibration.vibrate(pattern);
}

export function cueIntervalPhase(phase: IntervalPhase, options?: { speak?: boolean }): void {
  if (Platform.OS === 'web') return;
  const cue = PHASE_CUES[phase];
  buzz(cue.pattern);
  if (options?.speak === false) return;
  Speech.stop();
  Speech.speak(cue.words, { rate: cue.rate, pitch: cue.pitch });
}

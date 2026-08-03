import { Platform, Vibration } from 'react-native';

import type { IntervalPhase } from '@/lib/timerEngine';
import { speakCue } from '@/lib/voice/speakCue';

const PHASE_CUES: Record<
  IntervalPhase,
  { pattern: number[]; iosRepeats: number; words: string; rate: number; pitch: number }
> = {
  work: { pattern: [0, 220, 80, 220, 80, 280], iosRepeats: 3, words: 'Work', rate: 1.05, pitch: 1.12 },
  rest: { pattern: [0, 140, 70, 140], iosRepeats: 2, words: 'Rest', rate: 1, pitch: 0.95 },
  done: { pattern: [0, 280, 100, 280, 100, 280], iosRepeats: 3, words: 'Complete', rate: 1, pitch: 1 },
};

// iOS ignores vibration patterns, so fire several short buzzes to approximate a pulse.
function buzz(pattern: number[], iosRepeats: number): void {
  if (Platform.OS === 'ios') {
    let remaining = iosRepeats;
    const pulse = () => {
      Vibration.vibrate();
      remaining -= 1;
      if (remaining > 0) setTimeout(pulse, 180);
    };
    pulse();
    return;
  }
  Vibration.vibrate(pattern);
}

export function cueIntervalPhase(phase: IntervalPhase, options?: { speak?: boolean }): void {
  if (Platform.OS === 'web') return;
  const cue = PHASE_CUES[phase];
  buzz(cue.pattern, cue.iosRepeats);
  if (options?.speak === false) return;
  void speakCue(cue.words, { rate: cue.rate, pitch: cue.pitch });
}

/** End-of-phase countdown so rest→work is impossible to miss. */
export function cueIntervalCountdown(secondsRemaining: number): void {
  if (Platform.OS === 'web') return;
  if (secondsRemaining < 1 || secondsRemaining > 3) return;
  buzz([0, 90], 1);
  void speakCue(String(secondsRemaining), { rate: 1.15, pitch: 1.1 });
}

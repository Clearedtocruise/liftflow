import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import type { CoachAdjustmentLabel } from '@/types/exerciseCoach';

const LABELS: Record<CoachAdjustmentLabel, string> = {
  increase_weight: 'Increase weight',
  increase_reps: 'Increase reps',
  increase_sets: 'Coach adding a set',
  increase_duration: 'Increase hold time',
  maintain: 'Maintain',
  deload: 'Deload',
};

export function coachAdjustmentLabel(label: CoachAdjustmentLabel): string {
  return LABELS[label];
}

/** Bodyweight logging has no load. The coach engine still phrases advice as a working weight. */
export function coachReasonForLoggingMode(reason: string, mode: ExerciseLoggingMode): string {
  if (mode !== 'bodyweight') return reason;
  if (/no prior history/i.test(reason)) {
    return 'No prior history — log the reps you can do with good form.';
  }
  return reason.replace(/working weight/gi, 'rep target');
}

export function coachAdjustmentColor(label: CoachAdjustmentLabel): 'success' | 'accent' | 'textTertiary' | 'restTimer' {
  switch (label) {
    case 'increase_weight':
    case 'increase_reps':
    case 'increase_sets':
    case 'increase_duration':
      return 'success';
    case 'maintain':
      return 'accent';
    case 'deload':
      return 'restTimer';
  }
}

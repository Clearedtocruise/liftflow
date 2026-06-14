import type { CoachAdjustmentLabel } from '@/types/exerciseCoach';

const LABELS: Record<CoachAdjustmentLabel, string> = {
  increase_weight: 'Increase weight',
  increase_reps: 'Increase reps',
  increase_sets: 'Increase sets',
  increase_duration: 'Increase hold time',
  maintain: 'Maintain',
  deload: 'Deload',
};

export function coachAdjustmentLabel(label: CoachAdjustmentLabel): string {
  return LABELS[label];
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

import type {
  RecoveryIntelligenceStatus,
  TrainingDayRecommendation,
} from '@/types/recoveryIntelligence';

export function statusLabel(status: RecoveryIntelligenceStatus): string {
  switch (status) {
    case 'fully_recovered':
      return 'Fully Recovered';
    case 'recovering':
      return 'Recovering';
    case 'fatigued':
      return 'Fatigued';
    case 'overtrained':
      return 'Overtrained';
  }
}

export function trainingRecommendationLabel(rec: TrainingDayRecommendation): string {
  switch (rec) {
    case 'train':
      return 'Train';
    case 'train_light':
      return 'Train Light';
    case 'recovery_session':
      return 'Recovery Session';
    case 'rest_day':
      return 'Rest Day';
  }
}

export function statusColorKey(status: RecoveryIntelligenceStatus): 'success' | 'accent' | 'textTertiary' | 'restTimer' {
  switch (status) {
    case 'fully_recovered':
      return 'success';
    case 'recovering':
      return 'accent';
    case 'fatigued':
      return 'textTertiary';
    case 'overtrained':
      return 'restTimer';
  }
}

export function muscleScoreColor(score: number): 'success' | 'accent' | 'textTertiary' | 'restTimer' {
  if (score >= 85) return 'success';
  if (score >= 60) return 'accent';
  if (score >= 40) return 'textTertiary';
  return 'restTimer';
}

import { LiftFlowColors } from '@/constants/theme';
import type { NutritionCoachingAction, WeightTrend } from '@/types/nutritionIntelligence';

export function coachingActionLabel(action: NutritionCoachingAction): string {
  switch (action) {
    case 'increase_carbs':
      return 'Increase carbs';
    case 'reduce_calories':
      return 'Reduce calories';
    case 'increase_protein':
      return 'Increase protein';
    case 'hydration_reminder':
      return 'Hydration';
    case 'log_meals':
      return 'Log meals';
    default:
      return action;
  }
}

export function coachingActionColor(action: NutritionCoachingAction): string {
  switch (action) {
    case 'increase_carbs':
      return LiftFlowColors.accent;
    case 'reduce_calories':
      return LiftFlowColors.restTimer;
    case 'increase_protein':
      return LiftFlowColors.success;
    case 'hydration_reminder':
      return '#4A90D9';
    default:
      return LiftFlowColors.textSecondary;
  }
}

export function weightTrendLabel(trend: WeightTrend): string {
  switch (trend) {
    case 'losing':
      return 'Trending down';
    case 'gaining':
      return 'Trending up';
    case 'stable':
      return 'Stable';
    default:
      return 'Insufficient data';
  }
}

export function formatMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${ml} ml`;
}

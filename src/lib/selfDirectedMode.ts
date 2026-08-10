import type { UserProfile } from '@/types';

/**
 * Self-directed mode: the athlete runs their own workouts and/or nutrition.
 *
 * Coach autopilot (week regen, meal-plan day sync) stays off while these flags are set.
 * Existing history and logged meals are never deleted by flipping the switch.
 */

export function isSelfDirectedTraining(user?: UserProfile | null): boolean {
  return user?.metadata?.coachProfile?.selfDirectedTraining === true;
}

export function isSelfDirectedNutrition(user?: UserProfile | null): boolean {
  return user?.metadata?.coachProfile?.selfDirectedNutrition === true;
}

export function selfDirectedTrainingSummary(enabled: boolean): string {
  return enabled ? 'You log your own' : 'Coach plans your week';
}

export function selfDirectedNutritionSummary(enabled: boolean): string {
  return enabled ? 'You log your own' : 'Coach meal plans';
}

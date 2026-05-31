import { toNutritionGoal, type TrainingGoalId } from '@/constants/trainingGoals';

/** Persist ranked goals + derived nutrition primary to Supabase profiles. */
export function buildGoalsProfilePayload(rankedGoals: TrainingGoalId[]) {
  return {
    fitnessGoals: rankedGoals,
    primaryTrainingGoal: toNutritionGoal(rankedGoals[0]),
  };
}

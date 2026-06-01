import type { ProgramDashboard } from '@/types/training';

export type SupplementRecommendation = {
  name: string;
  rationale: string;
  priority: 'essential' | 'recommended' | 'optional';
};

export type CoachActivationResult = {
  programDashboard: ProgramDashboard | null;
  nutritionGoals: {
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    rationale: string;
  };
  coachMessage: string;
  supplementRecommendations: SupplementRecommendation[];
  mealPlanCreated: boolean;
  groceryListCreated: boolean;
};

export type PostWorkoutCoachSummary = {
  workoutSummary: string;
  recoveryRecommendation: string;
  nutritionRecommendation: string;
  progressionRecommendations: string[];
};

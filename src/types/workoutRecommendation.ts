export type RecommendedExercise = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  restSeconds: number;
  notes?: string;
};

export type WorkoutSplitStyle =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'bodybuilding'
  | 'powerlifting'
  | 'strength'
  | 'fat_loss';

export type MuscleExplanation = {
  muscle: string;
  reason: string;
};

export type RecommendedWorkout = {
  name: string;
  rationale: string;
  muscleGroups: string[];
  exercises: RecommendedExercise[];
  estimatedMinutes: number;
  aiGenerated: boolean;
};

export type DailyWorkoutRecommendation = {
  date: string;
  dayLabel: string;
  isRestDay: boolean;
  sessionLabel?: string;
  targetMuscles: string[];
  workout?: RecommendedWorkout;
  whySelected: string[];
  whyNotSelected: MuscleExplanation[];
  voiceLine: string;
};

export type WeeklyPlanDay = {
  date: string;
  dayLabel: string;
  isRestDay: boolean;
  sessionLabel?: string;
  targetMuscles: string[];
  estimatedMinutes?: number;
};

export type WorkoutRecommendationContext = {
  userId: string;
  recoveryScore: number;
  recoveryStatus: string;
  trainingRecommendation: string;
  goalFocus: string;
  splitStyle: WorkoutSplitStyle;
  splitLabel: string;
  frequency: number;
  adherencePct: number;
  missedWorkoutCount: number;
  weakMuscleGroups: string[];
  suggestedMuscleGroups: string[];
  avoidMuscleGroups: string[];
  workoutsLast7d: number;
  basedOnSessionCount: number;
};

export type WorkoutRecommendationReport = {
  assessedAt: string;
  context: WorkoutRecommendationContext;
  today: DailyWorkoutRecommendation;
  tomorrow: DailyWorkoutRecommendation;
  weeklyPlan: WeeklyPlanDay[];
  voiceTrainTodayLine: string;
  voiceBuildWorkoutLine: string;
};

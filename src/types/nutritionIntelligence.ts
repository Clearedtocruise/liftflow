export type NutritionGoalFocus = 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';

export type WeightTrend = 'losing' | 'gaining' | 'stable' | 'unknown';

export type NutritionCoachingAction =
  | 'increase_carbs'
  | 'reduce_calories'
  | 'increase_protein'
  | 'hydration_reminder'
  | 'log_meals';

export type NutritionIntelligenceContext = {
  userId: string;
  goal: NutritionGoalFocus;
  goalLabel: string;
  recoveryScore: number;
  recoveryStatus: string;
  trainingVolume7d: number;
  /** The user's own weekly volume over the preceding 4 weeks, when enough history exists. */
  trainingVolumeBaseline7d?: number;
  upcomingWorkout?: {
    date: string;
    name: string;
    muscleGroups: string[];
    isTrainingDay: boolean;
    workoutType: string;
  };
  weightTrend: WeightTrend;
  weightDeltaKg?: number;
  currentWeightKg?: number;
  adherencePct: number;
  nutritionLogDays7d: number;
  caloriesConsumedToday: number;
  proteinConsumedToday: number;
  carbsConsumedToday: number;
  fatConsumedToday: number;
  waterMlToday: number;
};

export type MacroTargetsWithHydration = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  hydrationMl: number;
  rationale: string;
};

export type DailyCoachingTip = {
  action: NutritionCoachingAction;
  title: string;
  message: string;
  priority: number;
};

export type MealSuggestion = {
  mealType: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rationale?: string;
};

export type GroceryItemSuggestion = {
  name: string;
  quantity?: string;
  category: string;
};

export type WeeklyNutritionDay = {
  date: string;
  dayLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isTrainingDay: boolean;
  focus?: string;
};

export type NutritionIntelligenceReport = {
  assessedAt: string;
  context: NutritionIntelligenceContext;
  macroTargets: MacroTargetsWithHydration;
  intakeToday: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterMl: number;
  };
  gapAnalysis: {
    caloriesRemaining: number;
    proteinRemainingG: number;
    carbsRemainingG: number;
    fatRemainingG: number;
    hydrationRemainingMl: number;
  };
  coachingTips: DailyCoachingTip[];
  mealSuggestions: MealSuggestion[];
  groceryList: GroceryItemSuggestion[];
  weeklyPlan: WeeklyNutritionDay[];
  rationale: string;
  voiceEatTodayLine: string;
  voiceGroceryLine: string;
};

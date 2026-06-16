export type WeeklyTrainingSummary = {
  workoutsCompleted: number;
  workoutsPlanned: number;
  workoutsMissed: string[];
  totalExercises: number;
  totalSets: number;
  totalVolumeKg: number;
  cardioSessions: number;
  sportsSessions: number;
  prs: Array<{ exerciseName: string; detail: string }>;
  bestLifts: Array<{ exerciseName: string; weightKg: number; reps: number }>;
  consistencyScore: number;
  coachSummary: string;
};

export type WeeklyNutritionSummary = {
  daysTracked: number;
  mealsCompleted: number;
  mealsPlanned: number;
  avgCalories: number;
  targetCalories: number;
  avgProteinG: number;
  targetProteinG: number;
  adherencePct: number;
  highestAdherenceDay: string | null;
  lowestAdherenceDay: string | null;
  missedMeals: number;
  coachSummary: string;
};

export type WeeklyRecoverySummary = {
  avgRecoveryScore: number;
  checkInsCompleted: number;
  trainingRecommendation: string;
  coachSummary: string;
};

export type WeeklyProgressSummary = {
  volumeChangePct: number | null;
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
  coachSummary: string;
};

export type WeeklyCloseoutSummary = {
  weekStartDate: string;
  weekEndDate: string;
  training: WeeklyTrainingSummary;
  nutrition: WeeklyNutritionSummary;
  recovery: WeeklyRecoverySummary;
  progress: WeeklyProgressSummary;
};

export type NextWeekPlanPreview = {
  weekStartDate: string;
  weekEndDate: string;
  focus: string;
  workoutDays: Array<{
    date: string;
    dayLabel: string;
    title: string;
    muscleGroups: string[];
    exerciseCount: number;
  }>;
  nutrition: {
    dailyCalories: number;
    dailyProteinG: number;
    coachSummary: string;
    days: Array<{ day: string; calories: number; proteinG: number; label: string }>;
  };
};

export type WeeklyCloseoutRecord = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: 'pending_review' | 'accepted' | 'archived';
  summary: WeeklyCloseoutSummary;
  nextWeekPlan: NextWeekPlanPreview;
};

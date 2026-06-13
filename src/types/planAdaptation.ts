export type PlanCoachMessage = {
  headline: 'Plan Adjusted';
  messages: string[];
  rationale: string;
};

export type DayNutritionAdaptation = {
  date: string;
  macros: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    rationale: string;
  };
  mealTiming: string[];
  hydrationNote: string;
  isTrainingDay: boolean;
  workoutName?: string;
  mealsUpdated: number;
  mealsInserted: number;
  mealsRemoved: number;
};

export type PlanAdaptationResult = {
  changeId: string;
  changeType: 'move' | 'swap' | 'skip';
  affectedDates: string[];
  fromDate: string;
  toDate: string;
  workoutName: string;
  training: {
    weeklyVolume: number;
    restDays: string[];
    volumeRedistributedTo?: string;
  };
  nutrition: {
    byDate: Record<string, DayNutritionAdaptation>;
  };
  coach: PlanCoachMessage;
};

export type ScheduleChangeMove = {
  type: 'move';
  workoutId: string;
  toDate: string;
};

export type ScheduleChangeSwap = {
  type: 'swap';
  workoutIdA: string;
  workoutIdB: string;
};

export type ScheduleChangeSkip = {
  type: 'skip';
  workoutId: string;
};

export type ScheduleChange = ScheduleChangeMove | ScheduleChangeSwap | ScheduleChangeSkip;

export type PlanAdjustment = PlanCoachMessage & {
  id?: string;
  createdAt?: string;
  affectedDates?: string[];
};

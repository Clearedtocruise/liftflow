export type PreferenceAdaptationTrigger = 'equipment' | 'nutrition' | 'all';

export type PreferenceAdaptationReport = {
  adapted: boolean;
  trigger: PreferenceAdaptationTrigger;
  workoutSwaps: Array<{ from: string; to: string; workoutDate: string; workoutName: string }>;
  mealSwaps: Array<{ from: string; to: string; date: string; mealType: string; reason: string }>;
  changes: string[];
  notificationTitle: string;
  notificationBody: string;
};

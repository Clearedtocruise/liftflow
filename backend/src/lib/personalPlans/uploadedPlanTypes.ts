export type UploadedPlanKind = 'workout' | 'nutrition';

export type ParsedWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
};

export type ParsedWorkoutDay = {
  dayIndex: number;
  label: string;
  muscleGroups: string[];
  exercises: ParsedWorkoutExercise[];
};

export type ParsedMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
  name: string;
  scheduledTime?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
};

export type ParsedNutritionDay = {
  dayIndex: number;
  meals: ParsedMeal[];
};

export type ParsedPersonalPlan = {
  title: string;
  kind: UploadedPlanKind;
  workouts?: ParsedWorkoutDay[];
  meals?: ParsedNutritionDay[];
  nutritionGoals?: {
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  };
};

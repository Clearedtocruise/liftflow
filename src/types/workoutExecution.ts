export type EditableWorkoutExercise = {
  id: string;
  name: string;
  sets: number;
  repRange?: string;
  restSeconds?: number;
  weightLbs?: number;
};

export type ExerciseHistorySet = {
  weightKg: number;
  reps: number;
  loggedAt: string;
};

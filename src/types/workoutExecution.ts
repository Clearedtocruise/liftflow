export type EditableWorkoutExercise = {
  id: string;
  name: string;
  sets: number;
  repRange?: string;
  restSeconds?: number;
  weightLbs?: number;
  /** Exercises sharing an id are performed as a superset (back-to-back sets). */
  supersetGroupId?: string;
};

export type ExerciseHistorySet = {
  weightKg: number;
  reps: number;
  loggedAt: string;
};

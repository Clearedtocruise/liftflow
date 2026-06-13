export type EditableWorkoutExercise = {
  id: string;
  exerciseId?: string;
  name: string;
  sets: number;
  repRange?: string;
  restSeconds?: number;
  weightLbs?: number;
  /** Sprint 2 — how this exercise is executed (traditional, tabata, etc.). */
  executionMode?: import('./workoutExecutionMode').WorkoutExecutionMode;
  /** Exercises sharing an id are performed as a superset (back-to-back sets). */
  supersetGroupId?: string;
};

export type ExerciseHistorySet = {
  weightKg: number;
  reps: number;
  loggedAt: string;
};

export type EditableWorkoutExercise = {
  id: string;
  exerciseId?: string;
  name: string;
  /** Strength-training sets. Never a count of interval/circuit rounds — see `intervalRounds`. */
  sets: number;
  repRange?: string;
  restSeconds?: number;
  weightLbs?: number;
  /** Rounds for interval (HIIT/Tabata) and circuit execution. Independent of `sets`. */
  intervalRounds?: number;
  intervalWorkSeconds?: number;
  intervalRestSeconds?: number;
  /** Rest between exercises within a superset/circuit station (seconds). */
  restBetweenExercisesSeconds?: number;
  /** Sprint 2 — how this exercise is executed (traditional, tabata, etc.). */
  executionMode?: import('./workoutExecutionMode').WorkoutExecutionMode;
  /** Exercises sharing an id are performed as a superset (back-to-back sets). */
  supersetGroupId?: string;
};

export type ExerciseHistorySet = {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  loggedAt: string;
};

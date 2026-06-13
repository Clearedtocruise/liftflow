/**
 * Sprint 2 — Workout execution modes (how an exercise is performed).
 * Distinct from Sprint 1 exercise types (strength/bodyweight/timed/cardio).
 */

export type WorkoutExecutionMode =
  | 'traditional'
  | 'hypertrophy'
  | 'strength'
  | 'hiit'
  | 'tabata'
  | 'circuit'
  | 'superset';

export const WORKOUT_EXECUTION_MODES: WorkoutExecutionMode[] = [
  'traditional',
  'hypertrophy',
  'strength',
  'hiit',
  'tabata',
  'circuit',
  'superset',
];

/** How sets are structured for a given mode prescription. */
export type ExecutionScheme = 'set_rep' | 'interval' | 'circuit' | 'superset';

export type SetRepPrescription = {
  scheme: 'set_rep';
  mode: WorkoutExecutionMode;
  sets: number;
  repRange: string;
  restSeconds: number;
};

export type IntervalPrescription = {
  scheme: 'interval';
  mode: WorkoutExecutionMode;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
};

export type CircuitPrescription = {
  scheme: 'circuit';
  mode: 'circuit';
  rounds: number;
  repRange: string;
  restBetweenExercisesSeconds: number;
  restBetweenRoundsSeconds: number;
};

export type SupersetPrescription = {
  scheme: 'superset';
  mode: 'superset';
  sets: number;
  repRange: string;
  restBetweenExercisesSeconds: number;
  restBetweenRoundSetsSeconds: number;
};

export type ExerciseExecutionPrescription =
  | SetRepPrescription
  | IntervalPrescription
  | CircuitPrescription
  | SupersetPrescription;

export type ExercisePrescriptionInput = {
  name: string;
  mode: WorkoutExecutionMode;
  /** Existing plan values — honored for traditional/hypertrophy/strength when present. */
  sets?: number;
  repRange?: string;
  restSeconds?: number;
};

export type PrescribedWorkoutExercise = {
  name: string;
  mode: WorkoutExecutionMode;
  prescription: ExerciseExecutionPrescription;
};

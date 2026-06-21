export const DEFAULT_REST_SECONDS = 90;

/** Must match backend PLAN_RULES_VERSION — triggers one-time program regeneration. */
export const WORKOUT_PLAN_RULES_VERSION = 6;

export const QUICK_CORRECTIONS = [
  { id: 'weight-up', label: 'Weight +5' },
  { id: 'weight-down', label: 'Weight −5' },
  { id: 'reps-up', label: 'Reps +1' },
  { id: 'reps-down', label: 'Reps −1' },
  { id: 'wrong-exercise', label: 'Wrong exercise' },
] as const;

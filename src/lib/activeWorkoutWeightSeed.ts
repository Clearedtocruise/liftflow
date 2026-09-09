import { defaultTimedDurationSeconds } from '@/lib/exerciseModality';
import { parseTargetReps } from '@/lib/workoutPlan';

/**
 * Seed the weight field when the active exercise changes (including superset rotation).
 * Prefer sets already logged on this exercise in the current session so partners do not
 * wipe each other's load back to 0.
 *
 * Never falls back to another exercise's last load — only this row's session sets, then
 * this movement's prior-session history, then this row's plan suggestion.
 */
export function resolveExerciseSeedWeightKg(input: {
  sessionSets: Array<{ weight?: number | null }>;
  historyWeightKg?: number | null;
  suggestedWeightKg?: number | null;
}): number {
  for (let i = input.sessionSets.length - 1; i >= 0; i -= 1) {
    const weight = input.sessionSets[i]?.weight;
    if (weight != null && weight > 0) return weight;
  }
  if (input.historyWeightKg != null && input.historyWeightKg > 0) return input.historyWeightKg;
  if (input.suggestedWeightKg != null && input.suggestedWeightKg > 0) return input.suggestedWeightKg;
  return 0;
}

export type ExerciseInputSeed = {
  weightKg: number;
  reps: number;
  durationSeconds: number;
};

type SessionSetSeed = {
  weight?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
};

/**
 * Full weight/reps/duration seed for an exercise card. Scoped to that exercise only so landing
 * on OHP after bench never inherits bench's load in the steppers (or in a follow-up Log Set).
 */
export function resolveExerciseInputSeed(input: {
  sessionSets: SessionSetSeed[];
  historyWeightKg?: number | null;
  historyReps?: number | null;
  historyDurationSeconds?: number | null;
  suggestedWeightKg?: number | null;
  planRepRange?: string | null;
}): ExerciseInputSeed {
  const lastSession = input.sessionSets[input.sessionSets.length - 1];
  const planReps = input.planRepRange ?? undefined;

  const weightKg = resolveExerciseSeedWeightKg({
    sessionSets: input.sessionSets,
    historyWeightKg: input.historyWeightKg,
    suggestedWeightKg: input.suggestedWeightKg,
  });

  let reps: number;
  if (lastSession?.reps != null && lastSession.reps > 0) {
    reps = lastSession.reps;
  } else if (input.historyReps != null && input.historyReps > 0) {
    reps = input.historyReps;
  } else {
    reps = parseTargetReps(planReps);
  }

  let durationSeconds: number;
  if (lastSession?.durationSeconds != null && lastSession.durationSeconds > 0) {
    durationSeconds = lastSession.durationSeconds;
  } else if (input.historyDurationSeconds != null && input.historyDurationSeconds > 0) {
    durationSeconds = input.historyDurationSeconds;
  } else {
    durationSeconds = defaultTimedDurationSeconds(planReps);
  }

  return { weightKg, reps, durationSeconds };
}

/**
 * How many sets finish the current exercise.
 *
 * The screen and the set logger used to work this out separately: the screen took interval rounds
 * for Tabata/HIIT while the logger always took the plan's set count. When those disagreed the
 * exercise could read as finished while sets remained — and the 1.8s auto-advance then skipped to
 * the next exercise on its own — or the logger refused a set the screen still showed as pending.
 */

import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export const DEFAULT_TARGET_SETS = 3;

const INTERVAL_MODES: WorkoutExecutionMode[] = ['tabata', 'hiit'];

export function executionModeUsesRounds(mode: WorkoutExecutionMode | undefined): boolean {
  return mode != null && INTERVAL_MODES.includes(mode);
}

export type TargetSetsInput = {
  executionMode?: WorkoutExecutionMode;
  /** Sets from the plan for this exercise. */
  planSets?: number | null;
  /** Extra sets the lifter added with "+ Add Set". */
  bonusSets?: number;
  /** Rounds from the live interval timer, when one is running. */
  intervalRounds?: number | null;
};

export function resolveEffectiveTargetSets(input: TargetSetsInput): number {
  const planSets = positive(input.planSets) ?? DEFAULT_TARGET_SETS;
  const bonusSets = Math.max(0, input.bonusSets ?? 0);

  if (executionModeUsesRounds(input.executionMode)) {
    // Rounds are the protocol; they only apply once a round count is actually known, otherwise the
    // plan still decides and the exercise cannot complete a set early.
    const rounds = positive(input.intervalRounds);
    return rounds ?? planSets + bonusSets;
  }

  return planSets + bonusSets;
}

/**
 * Prefer the planned set count from the workout template. Session fallback used to be 3, so a
 * 5-set pull-up completed after set 3 and skipped forward to barbell rows.
 */
export function resolveSessionExerciseTargetSets(input: {
  planSets?: number | null;
  sessionSuggestedSets?: number | null;
  bonusSets?: number;
}): number {
  const planned = positive(input.planSets);
  const suggested = positive(input.sessionSuggestedSets);
  const bonusSets = Math.max(0, input.bonusSets ?? 0);
  return (planned ?? suggested ?? DEFAULT_TARGET_SETS) + bonusSets;
}

function positive(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

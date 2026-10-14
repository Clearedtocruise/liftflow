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

function positive(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * How many sets the Target Performance line should name.
 *
 * The coach is handed the plan's own set count and answers in that unit, while the card counts
 * loggable sets — "2 sets × 20 sec each side" is four holds, and "Current set" and "Sets left" are
 * expanded to match. Target Performance read straight from the coach, so it said "2 sets × 50s
 * hold" beside "Current set 3 of 4". Pass `coachSets` already expanded the same way as `planSets`.
 *
 * Where the coach has not moved the volume this names the target the card is counting to, so a set
 * added with "+ Add Set" does not leave the line contradicting it either. A coach that genuinely
 * changed the set count — a deload, or low recovery trimming volume — still speaks for itself.
 */
export function resolveCoachTargetSets(
  coachSets: number | null | undefined,
  planSets: number,
  effectiveTargetSets: number,
): number {
  const coach = positive(coachSets);
  if (coach == null || coach === planSets) return effectiveTargetSets;
  return coach;
}

/**
 * Which exercise a resumed/remounted workout screen should land on.
 *
 * `ActiveWorkoutScreen` used to always start at index 0, so leaving the app mid-session (e.g.
 * after finishing exercise 1 and moving to exercise 2) and coming back landed back on the first
 * exercise — the next set logged there instead of the one actually in progress, and the exercise
 * the lifter was really on read as skipped because it never got a set. This walks the session in
 * order and returns the first exercise that still has sets left, so a resume lands where the
 * lifter actually was.
 */
export function firstIncompleteExerciseIndex(
  loggedSetCounts: number[],
  targets: TargetSetsInput[],
): number {
  for (let index = 0; index < loggedSetCounts.length; index += 1) {
    const target = resolveEffectiveTargetSets(targets[index] ?? {});
    if ((loggedSetCounts[index] ?? 0) < target) return index;
  }
  return Math.max(loggedSetCounts.length - 1, 0);
}

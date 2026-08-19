/**
 * Auto-advance to the next lift only after this visit's planned sets are logged and rest is over.
 * Opening a session, or landing on a lift with zero sets, must never skip forward.
 */

export const AUTO_ADVANCE_EXERCISE_MS = 1800;

export type AutoAdvanceCheck = {
  /** True only after this visit logged the last planned set. */
  justFinishedThisVisit: boolean;
  loggedSets: number;
  targetSets: number;
  restActive: boolean;
  paused: boolean;
  challengeOpen: boolean;
};

export function shouldAutoAdvanceAfterExercise(input: AutoAdvanceCheck): boolean {
  if (!input.justFinishedThisVisit) return false;
  if (input.paused || input.challengeOpen || input.restActive) return false;
  if (!(input.loggedSets > 0) || input.loggedSets < input.targetSets) return false;
  return true;
}

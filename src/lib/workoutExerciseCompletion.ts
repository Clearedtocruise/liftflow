/**
 * Which of the two "this exercise is done" screens to show: the rest clock, or the complete card.
 *
 * They cannot both be up — the complete card replaces the logging area the rest banner lives in —
 * and the rest that follows the last set is the one a lifter most wants to see, because it is the
 * rest before the next exercise.
 */

export type ExerciseCompletionCheck = {
  /** Every exercise in the current group (station, or just this lift) has its sets in. */
  groupComplete: boolean;
  loggedSets: number;
  /** Logged sets have reached the target, bonus sets included. */
  allSetsDone: boolean;
  restActive: boolean;
};

export function exerciseIsFinished(input: ExerciseCompletionCheck): boolean {
  return input.groupComplete && input.loggedSets > 0 && input.allSetsDone;
}

/**
 * A set is saved before the rest period that follows it is, so for a moment after the last set the
 * exercise reads as finished with no rest running. Deciding from both facts every time — rather
 * than only stepping aside for a rest that was already there — is what keeps the card from
 * claiming the screen in that gap and sitting on top of the rest clock for the next minute and a
 * half.
 */
export function shouldShowExerciseComplete(input: ExerciseCompletionCheck): boolean {
  return exerciseIsFinished(input) && !input.restActive;
}

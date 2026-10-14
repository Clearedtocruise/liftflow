/**
 * Whether the exercise-complete card is actually about to move the lifter on by itself.
 *
 * The card printed "Next exercise starting…" from little more than "rest is not running". Coming
 * back to an exercise finished earlier satisfies that, and so does a paused workout, so the card
 * announced a jump the auto-advance effect had already declined to schedule — a popup sitting over
 * a finished exercise going nowhere. The effect and the card both read this, so they cannot
 * disagree about what is going to happen next.
 */
export type ExerciseAutoAdvanceInput = {
  /** The exercise-complete card is up. */
  exerciseComplete: boolean;
  /** Between-set rest is still counting down; the advance waits for it. */
  restRunning: boolean;
  /** A challenge prompt owns the screen. */
  challengeOpen: boolean;
  workoutPaused: boolean;
  /** This visit logged the last set. Landing on an exercise finished earlier does not count. */
  justFinishedExercise: boolean;
  /** Tabata/HIIT own their completion signal, and the rounds still have to be logged. */
  usesIntervalTimer: boolean;
  loggedSets: number;
  targetSets: number;
};

export function willAutoAdvanceExercise(input: ExerciseAutoAdvanceInput): boolean {
  if (!input.exerciseComplete) return false;
  if (input.restRunning || input.challengeOpen || input.workoutPaused) return false;
  if (!input.justFinishedExercise) return false;
  if (input.usesIntervalTimer && input.loggedSets < input.targetSets) return false;
  return true;
}

/**
 * Coordination between the between-set rest timer and "move to the next exercise".
 *
 * After the last set of an exercise, rest starts with a pending auto-advance. If the
 * lifter taps Next Exercise while that rest is still running, the manual advance must
 * cancel the pending flag AND tear down the leftover rest — otherwise when rest lands
 * on 0 a second advance fires and the exercise they just landed on looks skipped.
 *
 * Skip Rest is the opposite: it should still honor a pending last-set advance so the
 * lifter is not stuck on the complete card after ending rest early.
 */

export type RestAdvanceCoordination = {
  /** True after the last set of an exercise while traditional rest is still running. */
  pendingExerciseAdvanceAfterRest: boolean;
  /** Superset partner index waiting for rest to hit 0 before swapping. */
  pendingAdvanceIndex: number | null;
};

export type RestSkipOutcome = {
  /** Cleared pending state after a Skip Rest tap. */
  cleared: RestAdvanceCoordination;
  /** Schedule the post-last-set auto-advance (1.8s) after rest is torn down. */
  scheduleAutoAdvance: boolean;
  /** Jump straight to this index (superset partner) after rest is torn down. */
  advanceToIndex: number | null;
};

export function emptyRestAdvanceCoordination(): RestAdvanceCoordination {
  return {
    pendingExerciseAdvanceAfterRest: false,
    pendingAdvanceIndex: null,
  };
}

/** Manual Next / Previous / Skip-exercise: cancel any deferred rest-driven advance. */
export function clearRestAdvanceCoordination(
  _state: RestAdvanceCoordination,
): RestAdvanceCoordination {
  return emptyRestAdvanceCoordination();
}

/**
 * Skip Rest while a last-set (or superset) advance was waiting on the timer.
 * Caller tears down rest separately; this only says what to do afterward.
 */
export function resolveRestSkipAdvance(state: RestAdvanceCoordination): RestSkipOutcome {
  if (state.pendingAdvanceIndex != null) {
    return {
      cleared: emptyRestAdvanceCoordination(),
      scheduleAutoAdvance: false,
      advanceToIndex: state.pendingAdvanceIndex,
    };
  }
  if (state.pendingExerciseAdvanceAfterRest) {
    return {
      cleared: emptyRestAdvanceCoordination(),
      scheduleAutoAdvance: true,
      advanceToIndex: null,
    };
  }
  return {
    cleared: emptyRestAdvanceCoordination(),
    scheduleAutoAdvance: false,
    advanceToIndex: null,
  };
}

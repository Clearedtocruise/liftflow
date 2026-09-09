import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearRestAdvanceCoordination,
  resolveRestSkipAdvance,
} from './workoutRestAdvance';

test('manual Next clears a pending last-set auto-advance so rest hitting 0 cannot skip ahead', () => {
  // Regression: Next Exercise while last-set rest was still running advanced once, then
  // rest→0 fired scheduleAutoExerciseAdvance and skipped the next exercise entirely.
  const cleared = clearRestAdvanceCoordination({
    pendingExerciseAdvanceAfterRest: true,
    pendingAdvanceIndex: null,
  });
  assert.deepEqual(cleared, {
    pendingExerciseAdvanceAfterRest: false,
    pendingAdvanceIndex: null,
  });
});

test('Skip Rest after the last set still schedules the auto-advance', () => {
  const outcome = resolveRestSkipAdvance({
    pendingExerciseAdvanceAfterRest: true,
    pendingAdvanceIndex: null,
  });
  assert.equal(outcome.scheduleAutoAdvance, true);
  assert.equal(outcome.advanceToIndex, null);
  assert.equal(outcome.cleared.pendingExerciseAdvanceAfterRest, false);
});

test('Skip Rest mid-sets with no pending advance does nothing extra', () => {
  const outcome = resolveRestSkipAdvance({
    pendingExerciseAdvanceAfterRest: false,
    pendingAdvanceIndex: null,
  });
  assert.equal(outcome.scheduleAutoAdvance, false);
  assert.equal(outcome.advanceToIndex, null);
});

test('Skip Rest prefers a pending superset partner index over the last-set auto-advance', () => {
  const outcome = resolveRestSkipAdvance({
    pendingExerciseAdvanceAfterRest: true,
    pendingAdvanceIndex: 3,
  });
  assert.equal(outcome.advanceToIndex, 3);
  assert.equal(outcome.scheduleAutoAdvance, false);
});

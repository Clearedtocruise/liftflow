import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAutoAdvanceAfterExercise } from './workoutAutoAdvance';

const ready = {
  justFinishedThisVisit: true,
  loggedSets: 5,
  targetSets: 5,
  restActive: false,
  paused: false,
  challengeOpen: false,
};

test('auto-advance waits until the last planned set is logged', () => {
  assert.equal(shouldAutoAdvanceAfterExercise(ready), true);
  assert.equal(shouldAutoAdvanceAfterExercise({ ...ready, loggedSets: 3, targetSets: 5 }), false);
});

test('auto-advance never fires before any sets are logged', () => {
  assert.equal(
    shouldAutoAdvanceAfterExercise({ ...ready, justFinishedThisVisit: false, loggedSets: 0, targetSets: 5 }),
    false,
  );
  assert.equal(shouldAutoAdvanceAfterExercise({ ...ready, loggedSets: 0, targetSets: 5 }), false);
});

test('auto-advance waits for rest after the last set', () => {
  assert.equal(shouldAutoAdvanceAfterExercise({ ...ready, restActive: true }), false);
});

test('revisiting an already-complete lift does not skip ahead', () => {
  assert.equal(shouldAutoAdvanceAfterExercise({ ...ready, justFinishedThisVisit: false }), false);
});

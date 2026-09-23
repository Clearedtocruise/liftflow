/**
 * The rest between exercises has to be visible.
 *
 * Reported from a session: "rest timer isn't working between some exercises". It was working —
 * the last set of an exercise starts a rest like any other set — but finishing the set also put
 * the exercise-complete card up, and that card renders in place of the rest banner and suppresses
 * the timer overlay. So the rest that matters most, the one before the next exercise, was the one
 * rest a lifter could never see: ninety seconds of a card that looked like nothing was happening.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { exerciseIsFinished, shouldShowExerciseComplete } from './workoutExerciseCompletion';

const finishedAndResting = {
  groupComplete: true,
  loggedSets: 3,
  allSetsDone: true,
  restActive: true,
};

test('the rest after the last set keeps the screen', () => {
  assert.equal(shouldShowExerciseComplete(finishedAndResting), false);
});

test('the complete card takes over once that rest ends', () => {
  assert.equal(shouldShowExerciseComplete({ ...finishedAndResting, restActive: false }), true);
});

test('a rest that starts a moment after the set still takes the screen back', () => {
  // The set is saved first and the rest period second, so for one render the exercise reads as
  // finished with no rest running. Both states have to be read every time, not just the first.
  const beforeRestStarts = { ...finishedAndResting, restActive: false };
  assert.equal(shouldShowExerciseComplete(beforeRestStarts), true);
  assert.equal(shouldShowExerciseComplete({ ...beforeRestStarts, restActive: true }), false);
});

test('an exercise mid-way through its sets is not finished', () => {
  assert.equal(exerciseIsFinished({ ...finishedAndResting, allSetsDone: false }), false);
  assert.equal(shouldShowExerciseComplete({ ...finishedAndResting, allSetsDone: false }), false);
});

test('landing on an exercise with nothing logged is not finished', () => {
  assert.equal(
    exerciseIsFinished({ ...finishedAndResting, loggedSets: 0, allSetsDone: true }),
    false,
  );
});

test('a partner still owed sets keeps the group open', () => {
  assert.equal(exerciseIsFinished({ ...finishedAndResting, groupComplete: false }), false);
});

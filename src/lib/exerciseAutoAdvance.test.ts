import assert from 'node:assert/strict';
import { test } from 'node:test';

import { willAutoAdvanceExercise, type ExerciseAutoAdvanceInput } from './exerciseAutoAdvance';

function advancing(overrides: Partial<ExerciseAutoAdvanceInput> = {}): ExerciseAutoAdvanceInput {
  return {
    exerciseComplete: true,
    restRunning: false,
    challengeOpen: false,
    workoutPaused: false,
    justFinishedExercise: true,
    usesIntervalTimer: false,
    loggedSets: 3,
    targetSets: 3,
    ...overrides,
  };
}

test('the last set of an exercise hands off to the next one', () => {
  assert.equal(willAutoAdvanceExercise(advancing()), true);
});

test('coming back to an exercise finished earlier does not move the lifter', () => {
  // The complete card is up because the sets are all in, not because they were just logged.
  // This is the case that printed "Next exercise starting…" over a card that never advanced.
  assert.equal(willAutoAdvanceExercise(advancing({ justFinishedExercise: false })), false);
});

test('a paused workout is not about to advance', () => {
  assert.equal(willAutoAdvanceExercise(advancing({ workoutPaused: true })), false);
});

test('rest and challenges hold the advance', () => {
  assert.equal(willAutoAdvanceExercise(advancing({ restRunning: true })), false);
  assert.equal(willAutoAdvanceExercise(advancing({ challengeOpen: true })), false);
});

test('an interval block waits for its rounds to be logged', () => {
  assert.equal(
    willAutoAdvanceExercise(advancing({ usesIntervalTimer: true, loggedSets: 2, targetSets: 8 })),
    false,
  );
  assert.equal(
    willAutoAdvanceExercise(advancing({ usesIntervalTimer: true, loggedSets: 8, targetSets: 8 })),
    true,
  );
});

test('nothing is advancing while the exercise is still being worked', () => {
  assert.equal(willAutoAdvanceExercise(advancing({ exerciseComplete: false })), false);
});

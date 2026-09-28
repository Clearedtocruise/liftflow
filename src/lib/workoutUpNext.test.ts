import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatIntervalRoundProgress,
  resolveTabataPrepUpNext,
  resolveWorkoutUpNext,
  restPopupNow,
} from './workoutUpNext';

test('formatIntervalRoundProgress includes sets left', () => {
  assert.equal(formatIntervalRoundProgress(1, 10), 'Round 1 of 10 · 10 left');
  assert.equal(formatIntervalRoundProgress(3, 10), 'Round 3 of 10 · 8 left');
  assert.equal(formatIntervalRoundProgress(10, 10), 'Round 10 of 10 · 1 left');
});

test('tabata active round labels show progress and remaining', () => {
  const labels = resolveWorkoutUpNext({
    exerciseName: 'Goblet squat',
    targetSets: 10,
    completedSetsCount: 2,
    isLastExercise: false,
    nextExerciseName: 'Push-up',
    activeSetNumber: 3,
  });
  assert.equal(labels.currentSetLabel, 'Round 3 of 10 · 8 left');
  assert.equal(labels.upNextLabel, 'Round 4 of 10 · 7 left');
});

test('rest after the last set opens on set 1 of the next exercise', () => {
  // Still standing on the finished lift: the clock must not call that lift "Now".
  const fromFinished = restPopupNow({
    exerciseName: 'Pull Up',
    targetSets: 3,
    completedSetsCount: 3,
    isLastExercise: false,
    nextExerciseName: 'Barbell Row',
    nextExerciseTargetSets: 3,
  });
  assert.equal(fromFinished.exerciseName, 'Barbell Row');
  assert.equal(fromFinished.currentSetLabel, 'Set 1 of 3');

  // Already stepped onto the next lift, which has no sets yet. Same answer.
  const fromNext = restPopupNow({
    exerciseName: 'Barbell Row',
    targetSets: 3,
    completedSetsCount: 0,
    isLastExercise: false,
    nextExerciseName: 'Overhead Press',
    nextExerciseTargetSets: 3,
  });
  assert.equal(fromNext.exerciseName, 'Barbell Row');
  assert.equal(fromNext.currentSetLabel, 'Set 1 of 3');
  assert.equal(fromNext.upNextLabel, 'Set 2 of 3');
});

test('rest between sets stays on the same exercise', () => {
  const labels = restPopupNow({
    exerciseName: 'Pull Up',
    targetSets: 3,
    completedSetsCount: 1,
    isLastExercise: false,
    nextExerciseName: 'Barbell Row',
    nextExerciseTargetSets: 3,
  });
  assert.equal(labels.exerciseName, 'Pull Up');
  assert.equal(labels.currentSetLabel, 'Set 2 of 3');
  assert.equal(labels.upNextLabel, 'Set 3 of 3');
});

test('a finished pull-up set does not still say one set is left', () => {
  const labels = resolveWorkoutUpNext({
    exerciseName: 'Pull Up',
    targetSets: 3,
    completedSetsCount: 3,
    isLastExercise: false,
    nextExerciseName: 'Barbell Row',
    nextExerciseTargetSets: 3,
  });
  assert.equal(labels.currentSetLabel, 'Set 3 of 3 · done');
  assert.equal(labels.upNextLabel, 'Barbell Row · Set 1 of 3');
});

test('a finished set does not still say one set is left', () => {
  const labels = resolveWorkoutUpNext({
    exerciseName: 'Incline DB Press',
    targetSets: 3,
    completedSetsCount: 3,
    isLastExercise: false,
    nextExerciseName: 'OHP',
    nextExerciseTargetSets: 3,
  });
  assert.equal(labels.currentSetLabel, 'Set 3 of 3 · done');
  assert.equal(labels.upNextLabel, 'OHP · Set 1 of 3');
  assert.equal(labels.exerciseName, 'Incline DB Press');
});

test('tabata prep prompts logging before work', () => {
  const labels = resolveTabataPrepUpNext('Goblet squat', 10);
  assert.match(labels.currentSetLabel, /Log weight · 10 rounds/);
  assert.match(labels.upNextLabel, /Round 1 of 10/);
});

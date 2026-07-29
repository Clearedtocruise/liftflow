import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatIntervalRoundProgress,
  resolveTabataPrepUpNext,
  resolveWorkoutUpNext,
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

test('tabata prep prompts logging before work', () => {
  const labels = resolveTabataPrepUpNext('Goblet squat', 10);
  assert.match(labels.currentSetLabel, /Log weight · 10 rounds/);
  assert.match(labels.upNextLabel, /Round 1 of 10/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExerciseInputSeed, resolveExerciseSeedWeightKg } from './activeWorkoutWeightSeed';

test('prefers this session last set over history and suggestion', () => {
  assert.equal(
    resolveExerciseSeedWeightKg({
      sessionSets: [{ weight: 40 }, { weight: 42.5 }],
      historyWeightKg: 50,
      suggestedWeightKg: 45,
    }),
    42.5,
  );
});

test('falls back to prior-session history when this exercise has no sets yet', () => {
  assert.equal(
    resolveExerciseSeedWeightKg({
      sessionSets: [],
      historyWeightKg: 50,
      suggestedWeightKg: 45,
    }),
    50,
  );
});

test('falls back to suggested weight, then zero', () => {
  assert.equal(
    resolveExerciseSeedWeightKg({
      sessionSets: [{ weight: 0 }],
      historyWeightKg: null,
      suggestedWeightKg: 45,
    }),
    45,
  );
  assert.equal(
    resolveExerciseSeedWeightKg({
      sessionSets: [],
      historyWeightKg: undefined,
      suggestedWeightKg: undefined,
    }),
    0,
  );
});

test('input seed never invents a weight from a previous exercise — empty session stays at plan/history only', () => {
  // Regression: landing on OHP after bench must not keep bench's 80 kg in the steppers.
  // resolveExerciseInputSeed is only given THIS exercise's session sets.
  const ohpSeed = resolveExerciseInputSeed({
    sessionSets: [],
    historyWeightKg: 40,
    historyReps: 6,
    suggestedWeightKg: 35,
    planRepRange: '6-8',
  });
  assert.equal(ohpSeed.weightKg, 40);
  assert.equal(ohpSeed.reps, 6);

  const firstTimeOhp = resolveExerciseInputSeed({
    sessionSets: [],
    suggestedWeightKg: 35,
    planRepRange: '6-8',
  });
  assert.equal(firstTimeOhp.weightKg, 35);
  assert.equal(firstTimeOhp.reps, 6);
});

test('input seed prefers this session set over history when rotating back in a superset', () => {
  const seed = resolveExerciseInputSeed({
    sessionSets: [{ weight: 22.5, reps: 12 }],
    historyWeightKg: 20,
    historyReps: 15,
    suggestedWeightKg: 18,
    planRepRange: '10-12',
  });
  assert.equal(seed.weightKg, 22.5);
  assert.equal(seed.reps, 12);
});

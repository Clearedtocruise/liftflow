import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExerciseSeedWeightKg } from './activeWorkoutWeightSeed';

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

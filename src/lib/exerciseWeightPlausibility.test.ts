import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampPlanWeightKgForExercise,
  exerciseLooksLikeLightIsolationName,
} from './exerciseWeightPlausibility';

test('DB Kickback is treated as light isolation', () => {
  assert.equal(exerciseLooksLikeLightIsolationName('DB Kickback', 'db-kickback'), true);
  assert.equal(exerciseLooksLikeLightIsolationName('Bench Press', 'bench-press'), false);
});

test('clamp drops compound-scale kickback targets', () => {
  // 175 lb ≈ 79.4 kg — absurd for a dumbbell kickback
  assert.equal(clampPlanWeightKgForExercise(79.4, 'DB Kickback', 'db-kickback'), undefined);
  assert.equal(clampPlanWeightKgForExercise(10, 'DB Kickback', 'db-kickback'), 10);
  assert.equal(clampPlanWeightKgForExercise(79.4, 'Bench Press', 'bench-press'), 79.4);
});

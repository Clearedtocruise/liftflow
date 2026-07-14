import assert from 'node:assert/strict';
import test from 'node:test';

import { ageTrainingAdjustments, isHighImpactExercise } from './workoutPlanner.js';

test('ageTrainingAdjustments leaves young adults unchanged', () => {
  assert.deepEqual(ageTrainingAdjustments(30), {
    volumeMultiplier: 1,
    intensityMultiplier: 1,
    restSecondsBonus: 0,
    preferLowImpact: false,
  });
  assert.deepEqual(ageTrainingAdjustments(null), {
    volumeMultiplier: 1,
    intensityMultiplier: 1,
    restSecondsBonus: 0,
    preferLowImpact: false,
  });
});

test('ageTrainingAdjustments softens load for 55+', () => {
  const mods = ageTrainingAdjustments(58);
  assert.equal(mods.preferLowImpact, true);
  assert.ok(mods.volumeMultiplier < 1);
  assert.ok(mods.intensityMultiplier < 1);
  assert.ok(mods.restSecondsBonus > 0);
});

test('ageTrainingAdjustments is strongest at 65+', () => {
  const mid = ageTrainingAdjustments(55);
  const senior = ageTrainingAdjustments(70);
  assert.ok(senior.volumeMultiplier < mid.volumeMultiplier);
  assert.ok(senior.restSecondsBonus > mid.restSecondsBonus);
  assert.equal(senior.preferLowImpact, true);
});

test('isHighImpactExercise tags plyometric and jump patterns', () => {
  assert.equal(isHighImpactExercise({ slug: 'box-jump', name: 'Box Jump' }), true);
  assert.equal(isHighImpactExercise({ slug: 'burpee', name: 'Burpee' }), true);
  assert.equal(isHighImpactExercise({ slug: 'goblet-squat', name: 'Goblet Squat' }), false);
});

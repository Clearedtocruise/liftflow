import assert from 'node:assert/strict';
import test from 'node:test';

import { isPlausibleWorkingWeightKg } from './exerciseStartingLoad.ts';

test('rejects impossible Plate Curl working weights', () => {
  assert.equal(isPlausibleWorkingWeightKg('Plate Curl', 79.4), false); // ~175 lb
  assert.equal(isPlausibleWorkingWeightKg('Plate Curl', 11.3), true); // ~25 lb
  assert.equal(isPlausibleWorkingWeightKg('Barbell Back Squat', 180), true);
});

console.log('exerciseStartingLoad.test.ts — all assertions passed');

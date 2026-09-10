import assert from 'node:assert/strict';
import { test } from 'node:test';

import { kgToDisplayWeight, sumConsumedMealMacros } from './postWorkoutCoach.js';

test('an lbs user sees total volume converted from kg, not the raw kg number', () => {
  // 135 lb x 5 reps logged (stored as ~61.235 kg) => total_volume ~= 306.175 kg-reps.
  // The reported bug: the summary printed "306 total volume" with no unit — reading as kg to an
  // lbs user who expected ~675.
  const totalVolumeKg = 306.175;
  assert.equal(kgToDisplayWeight(totalVolumeKg, 'lbs'), 675);
});

test('a kg user sees total volume unconverted', () => {
  assert.equal(kgToDisplayWeight(306.175, 'kg'), 306.2);
  assert.equal(kgToDisplayWeight(300, 'kg'), 300);
});

test('a progression increase is converted to the display unit before being printed', () => {
  // suggested_weight of 100 kg -> increaseKg = max(2.5, round(100 * 0.025, 0.5)) = 2.5 kg.
  // An lbs user must see "6 lb" (2.5 kg converted), not "2.5 lb" — the unconverted kg number
  // mislabeled as pounds, which understated the real jump by more than half.
  const increaseKg = 2.5;
  assert.equal(kgToDisplayWeight(increaseKg, 'lbs'), 6);
  assert.equal(kgToDisplayWeight(increaseKg, 'kg'), 2.5);
});

test('zero and missing values never render as a negative or NaN weight', () => {
  assert.equal(kgToDisplayWeight(0, 'lbs'), 0);
  assert.equal(kgToDisplayWeight(0, 'kg'), 0);
});

test('post-workout protein only counts meals marked eaten, not the uneaten plan', () => {
  // Regression: summing every meal for the day reported "Protein on track (248g / 200g)" when
  // most of that protein still belonged to planned rows the lifter had not confirmed.
  const totals = sumConsumedMealMacros([
    { protein_g: 48, calories: 600, status: 'completed' },
    { protein_g: 40, calories: 500, status: 'planned' },
    { protein_g: 55, calories: 700, status: 'modified' },
    { protein_g: 105, calories: 1365, status: 'planned' },
  ]);
  assert.equal(Math.round(totals.proteinG), 103);
  assert.equal(Math.round(totals.calories), 1100);
});

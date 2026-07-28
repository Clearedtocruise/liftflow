import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateFoodMacrosLocal } from './foodMacroEstimator.js';

test('mixed oikos snack is not estimated as peanut butter by the pound', () => {
  const estimate = estimateFoodMacrosLocal(
    'Oikos Triple Zero, Blueberries, 2 Tablespoons Peanut Butter with 3 Tablespoons Peanuts',
    '1',
  );
  assert.ok(estimate.calories < 500, `expected <500 kcal, got ${estimate.calories}`);
  assert.ok(estimate.fatG < 40, `expected <40 g fat, got ${estimate.fatG}`);
});

test('2 tbsp peanut butter alone stays near label calories', () => {
  const estimate = estimateFoodMacrosLocal('2 tablespoons peanut butter', '1');
  assert.ok(estimate.calories >= 170 && estimate.calories <= 220, `got ${estimate.calories}`);
});

test('oatmeal with banana and peanut butter is not 800 calories', () => {
  const estimate = estimateFoodMacrosLocal('Oatmeal with banana and peanut butter', '1 serving');
  assert.ok(estimate.calories < 550, `got ${estimate.calories}`);
});

test('bare peanut butter serving 1 uses tbsp default', () => {
  const estimate = estimateFoodMacrosLocal('Peanut Butter', '1');
  assert.ok(estimate.calories >= 170 && estimate.calories <= 220, `got ${estimate.calories}`);
});

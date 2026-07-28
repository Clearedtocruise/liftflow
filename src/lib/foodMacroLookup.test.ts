import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateFoodMacrosLocal,
  extractEmbeddedServing,
  splitCompositeFoodParts,
} from './foodMacroLookup';

test('does not price a mixed snack as several ounces of peanut butter', () => {
  const estimate = estimateFoodMacrosLocal(
    'Oikos Triple Zero, Blueberries, 2 Tablespoons Peanut Butter with 3 Tablespoons Peanuts',
    '1 serving',
  );

  // Previous bug: ~672–850+ kcal / ~58–73F by treating the whole title as peanut butter.
  assert.ok(estimate.calories < 500, `expected <500 kcal, got ${estimate.calories}`);
  assert.ok(estimate.fatG < 40, `expected <40 g fat, got ${estimate.fatG}`);
  assert.ok(estimate.calories > 200, `expected a real snack, got ${estimate.calories}`);
});

test('ingredient line with embedded tbsp uses that serving when qty is "1"', () => {
  const estimate = estimateFoodMacrosLocal('2 tablespoons peanut butter', '1');
  // ~1.14 oz × 168 ≈ 191
  assert.ok(estimate.calories >= 170 && estimate.calories <= 220, `got ${estimate.calories}`);
  assert.ok(estimate.fatG >= 14 && estimate.fatG <= 20, `got ${estimate.fatG}`);
});

test('peanuts are not matched as peanut butter', () => {
  const estimate = estimateFoodMacrosLocal('3 tablespoons peanuts', '1');
  // ~0.96 oz × 160 ≈ 154
  assert.ok(estimate.calories >= 120 && estimate.calories <= 180, `got ${estimate.calories}`);
});

test('splitCompositeFoodParts breaks snack titles into foods', () => {
  const parts = splitCompositeFoodParts(
    'Oikos Triple Zero, Blueberries, 2 Tablespoons Peanut Butter with 3 Tablespoons Peanuts',
  );
  assert.ok(parts.length >= 3);
  assert.ok(parts.some((part) => /oikos/i.test(part)));
  assert.ok(parts.some((part) => /peanut butter/i.test(part)));
  assert.ok(parts.some((part) => /peanuts/i.test(part)));
});

test('extractEmbeddedServing pulls tbsp amounts out of the food name', () => {
  const embedded = extractEmbeddedServing('2 Tablespoons Peanut Butter');
  assert.deepEqual(embedded, { serving: '2 Tablespoons', food: 'Peanut Butter' });
});

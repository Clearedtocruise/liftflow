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

test('oatmeal with banana and peanut butter stays near plan calories', () => {
  const estimate = estimateFoodMacrosLocal('Oatmeal with banana and peanut butter', '1 serving');
  assert.ok(estimate.calories < 550, `got ${estimate.calories}`);
  assert.ok(estimate.fatG < 25, `got ${estimate.fatG}`);
});

test('bare peanut butter with serving "1" uses 2 tbsp not 4 oz', () => {
  const estimate = estimateFoodMacrosLocal('Peanut Butter', '1');
  assert.ok(estimate.calories >= 170 && estimate.calories <= 220, `got ${estimate.calories}`);
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

test('3 whole eggs counts as three eggs, not a generic 4 oz food', () => {
  const embedded = extractEmbeddedServing('3 whole eggs');
  assert.deepEqual(embedded, { serving: '3 piece', food: 'egg' });
  const estimate = estimateFoodMacrosLocal('3 whole eggs', '1');
  // ~3 × 1.75 oz × 41 cal ≈ 215
  assert.ok(estimate.calories >= 190 && estimate.calories <= 240, `got ${estimate.calories}`);
  assert.ok(estimate.proteinG >= 16 && estimate.proteinG <= 22, `got ${estimate.proteinG}`);
  assert.ok(estimate.carbsG < 3, `eggs should not invent ~12g carbs, got ${estimate.carbsG}`);
});

test('eggs plus egg whites sums both foods', () => {
  const estimate = estimateFoodMacrosLocal('3 whole eggs, 1/2 cup egg whites', '1');
  // eggs ~215 + whites ~65 ≈ 280
  assert.ok(estimate.calories >= 250 && estimate.calories <= 320, `got ${estimate.calories}`);
  assert.ok(estimate.proteinG >= 28 && estimate.proteinG <= 40, `got ${estimate.proteinG}`);
});

test('eggs whites and whey include the protein shake', () => {
  const estimate = estimateFoodMacrosLocal(
    '3 Whole Eggs, 1/2 Cup Egg Whites with Optimum Whey Protein In Water',
    '1',
  );
  assert.ok(estimate.calories >= 350 && estimate.calories <= 450, `got ${estimate.calories}`);
  assert.ok(estimate.proteinG >= 48 && estimate.proteinG <= 70, `got ${estimate.proteinG}`);
});

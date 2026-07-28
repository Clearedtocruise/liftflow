import assert from 'node:assert/strict';
import test from 'node:test';

import { looksLikeDaySizedMealMacros, resolveMealMacros } from './mealIngredients';

test('screenshot dinner macros are treated as day-sized and corrected', () => {
  const meal = {
    name: 'lean beef with roasted vegetables',
    mealType: 'dinner',
    calories: 3392,
    proteinG: 266,
    carbsG: 371,
    fatG: 94,
    macrosProvided: true,
  };

  assert.equal(looksLikeDaySizedMealMacros(meal), true);

  const macros = resolveMealMacros(meal);
  assert.ok(macros.calories < 900, `expected template dinner, got ${macros.calories}`);
  assert.ok(macros.proteinG < 60, `got ${macros.proteinG}`);
  assert.notEqual(macros.calories, 3392);
});

test('normal dinner macros are left alone', () => {
  const meal = {
    name: 'lean beef with roasted vegetables',
    mealType: 'dinner',
    calories: 720,
    proteinG: 48,
    carbsG: 32,
    fatG: 32,
    macrosProvided: true,
  };

  assert.equal(looksLikeDaySizedMealMacros(meal), false);
  assert.deepEqual(resolveMealMacros(meal), {
    calories: 720,
    proteinG: 48,
    carbsG: 32,
    fatG: 32,
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  correctedMacrosIfInflated,
  looksLikeDaySizedMealMacros,
  looksLikeInflatedPlanMacros,
  resolveMealMacros,
} from './mealIngredients';

test('screenshot dinner macros are treated as inflated and corrected', () => {
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
  assert.equal(looksLikeInflatedPlanMacros(meal), true);

  const macros = resolveMealMacros(meal);
  assert.ok(macros.calories < 900, `expected template dinner, got ${macros.calories}`);
  assert.ok(macros.proteinG < 60, `got ${macros.proteinG}`);
  assert.notEqual(macros.calories, 3392);
});

test('Tuesday week-view meals are all flagged and corrected to meal-sized macros', () => {
  const tuesday = [
    {
      name: 'Rice cakes with honey',
      mealType: 'pre_workout',
      calories: 1131,
      proteinG: 20,
      carbsG: 245,
      fatG: 9,
    },
    {
      name: 'Oatmeal with banana and peanut butter',
      mealType: 'breakfast',
      calories: 2827,
      proteinG: 221,
      carbsG: 309,
      fatG: 79,
    },
    {
      name: 'Protein bar and apple',
      mealType: 'snack',
      calories: 1131,
      proteinG: 89,
      carbsG: 124,
      fatG: 31,
    },
    {
      name: 'lean beef and quinoa salad',
      mealType: 'lunch',
      calories: 3958,
      proteinG: 310,
      carbsG: 433,
      fatG: 110,
    },
    {
      name: 'Chocolate milk and banana',
      mealType: 'post_workout',
      calories: 1508,
      proteinG: 89,
      carbsG: 226,
      fatG: 28,
    },
    {
      name: 'Lean lean beef stir-fry with rice',
      mealType: 'dinner',
      calories: 3392,
      proteinG: 266,
      carbsG: 371,
      fatG: 94,
    },
  ];

  for (const meal of tuesday) {
    assert.equal(
      looksLikeInflatedPlanMacros(meal),
      true,
      `expected inflated: ${meal.name} (${meal.calories})`,
    );
    const macros = resolveMealMacros(meal);
    assert.ok(
      macros.calories < 900,
      `${meal.name}: expected meal-sized calories, got ${macros.calories}`,
    );
    assert.notEqual(macros.calories, meal.calories);
  }
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

test('Today screenshot breakfast/snack correct via correctedMacrosIfInflated', () => {
  const breakfast = correctedMacrosIfInflated({
    name: 'Greek yogurt bowl with berries',
    mealType: 'breakfast',
    calories: 2827,
    proteinG: 221,
    carbsG: 212,
    fatG: 122,
  });
  assert.ok(breakfast);
  assert.ok(breakfast!.calories < 600, `got ${breakfast!.calories}`);
  assert.notEqual(breakfast!.calories, 2827);

  const snack = correctedMacrosIfInflated({
    name: 'Apple with almond butter',
    mealType: 'snack',
    calories: 1131,
    proteinG: 89,
    carbsG: 85,
    fatG: 49,
  });
  assert.ok(snack);
  assert.ok(snack!.calories < 350, `got ${snack!.calories}`);
  assert.notEqual(snack!.calories, 1131);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  correctedMacrosIfInflated,
  correctedStoredMacrosIfDaySized,
  looksLikeDaySizedMealMacros,
  looksLikeDaySizedStoredMeal,
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
    const generated = correctedMacrosIfInflated(meal);
    assert.ok(generated, meal.name);
    assert.ok(
      generated!.calories < 900,
      `${meal.name}: expected meal-sized calories, got ${generated!.calories}`,
    );
    assert.notEqual(generated!.calories, meal.calories);
  }

  // Already stored, only the rows that are plainly a whole day are rewritten on screen.
  for (const meal of tuesday.filter((row) => row.calories >= 1800)) {
    assert.ok(resolveMealMacros(meal).calories < 900, meal.name);
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

test('a logged pre-workout shake over the type cap keeps the user-entered macros', () => {
  // Regression: "optimum weight gainer protein 600 cals" logged as a 600 cal pre-workout meal
  // was silently rescaled to 288 cal / 14P / 43C / 5F because the plan-inflation heuristic ran
  // against a real logged meal, not just plan-generated rows.
  const loggedShake = {
    name: 'Optimum weight gainer protein 600 cals',
    mealType: 'pre_workout',
    calories: 600,
    proteinG: 30,
    carbsG: 90,
    fatG: 10,
    macrosProvided: true,
    origin: 'log',
  };

  assert.equal(looksLikeInflatedPlanMacros(loggedShake), false);
  assert.deepEqual(resolveMealMacros(loggedShake), {
    calories: 600,
    proteinG: 30,
    carbsG: 90,
    fatG: 10,
  });

  const loggedBigShake = { ...loggedShake, calories: 1000, proteinG: 60, carbsG: 150, fatG: 16 };
  assert.equal(looksLikeInflatedPlanMacros(loggedBigShake), true);
  assert.deepEqual(resolveMealMacros(loggedBigShake), {
    calories: 1000,
    proteinG: 60,
    carbsG: 150,
    fatG: 16,
  });
});

test('a generated plan row over the type cap is corrected before it is saved', () => {
  const planRow = {
    name: 'Rice cakes with honey',
    mealType: 'pre_workout',
    calories: 1131,
    proteinG: 20,
    carbsG: 245,
    fatG: 9,
    origin: 'plan',
  };

  const corrected = correctedMacrosIfInflated(planRow);
  assert.ok(corrected);
  assert.ok(corrected!.calories < 450, `expected corrected calories, got ${corrected!.calories}`);
});

test('a stored plan row is not rewritten just for beating its slot cap', () => {
  const planRow = {
    name: 'Rice cakes with honey',
    mealType: 'pre_workout',
    calories: 1131,
    proteinG: 20,
    carbsG: 245,
    fatG: 9,
    origin: 'plan',
    status: 'planned',
    macrosProvided: true,
  };

  assert.equal(looksLikeDaySizedStoredMeal(planRow), false);
  assert.equal(correctedStoredMacrosIfDaySized(planRow), null);
  assert.equal(resolveMealMacros(planRow).calories, 1131);
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

test('a burrito swapped into the post-workout slot keeps its 875 calories', () => {
  // Regression: the slot cap (550) flagged the swapped-in meal as a corrupted plan row, rescaled it
  // to 2400 x 13% = 312 cal, and the heal step wrote that over the lifter's number.
  const burrito = {
    name: 'chipotle barbacoa burrito',
    mealType: 'post_workout',
    calories: 875,
    proteinG: 50,
    carbsG: 80,
    fatG: 36,
    macrosProvided: true,
    origin: 'plan',
  };

  for (const status of ['planned', 'completed', 'modified']) {
    const meal = { ...burrito, status };
    assert.equal(looksLikeDaySizedStoredMeal(meal), false, status);
    assert.equal(correctedStoredMacrosIfDaySized(meal), null, status);
    assert.deepEqual(resolveMealMacros(meal), {
      calories: 875,
      proteinG: 50,
      carbsG: 80,
      fatG: 36,
    });
  }
});

test('numbers the lifter confirmed are never rewritten, however large', () => {
  const huge = {
    name: 'Oatmeal with banana',
    mealType: 'breakfast',
    calories: 2827,
    proteinG: 221,
    carbsG: 309,
    fatG: 79,
    macrosProvided: true,
  };

  for (const confirmed of [{ origin: 'log' }, { origin: 'plan', status: 'completed' }, { origin: 'plan', status: 'modified' }]) {
    const meal = { ...huge, ...confirmed };
    assert.equal(looksLikeDaySizedStoredMeal(meal), false);
    assert.deepEqual(resolveMealMacros(meal), {
      calories: 2827,
      proteinG: 221,
      carbsG: 309,
      fatG: 79,
    });
  }

  assert.equal(looksLikeDaySizedStoredMeal({ ...huge, origin: 'plan', status: 'planned' }), true);
});

test('a logged peanut-butter meal keeps its calories instead of the catalog guess', () => {
  const logged = {
    name: 'oikos greek yogurt, with 2 tablespoons of peanut butter, 2 tablespoons of honey, and a handful of blueberries',
    mealType: 'snack',
    calories: 700,
    proteinG: 30,
    carbsG: 60,
    fatG: 40,
    macrosProvided: true,
    origin: 'log',
  };
  assert.equal(resolveMealMacros(logged).calories, 700);
});

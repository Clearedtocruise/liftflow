import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeImportedNutritionPlan } from './importedNutritionPlan.js';
import type { ImportedNutritionPlan } from './pdfProgramParse.js';

/**
 * The commit endpoint now applies the plan the user reviewed and corrected on device, so these
 * bounds are the trust boundary: `dayIndex` is added straight onto the week start, and every macro
 * lands in a column the nutrition screens total up.
 */

test('a day index outside the week is dropped rather than scattering meals', () => {
  const plan = {
    days: [
      { dayIndex: 0, meals: [{ mealType: 'breakfast', name: 'Oats' }] },
      { dayIndex: 7, meals: [{ mealType: 'lunch', name: 'Too far' }] },
      { dayIndex: -1, meals: [{ mealType: 'lunch', name: 'Before the week' }] },
      { dayIndex: 1.5, meals: [{ mealType: 'lunch', name: 'Not a day' }] },
    ],
  } as unknown as ImportedNutritionPlan;

  const normalized = normalizeImportedNutritionPlan(plan);
  assert.equal(normalized.days.length, 2);
  assert.deepEqual(
    normalized.days.map((day) => day.dayIndex),
    [0, 1],
  );
  assert.equal(normalized.days[1]?.meals[0]?.name, 'Not a day');
});

test('two entries for the same day are merged instead of overwriting each other', () => {
  const plan = {
    days: [
      { dayIndex: 2, label: 'Training day', meals: [{ mealType: 'breakfast', name: 'Eggs' }] },
      { dayIndex: 2, meals: [{ mealType: 'dinner', name: 'Steak' }] },
    ],
  } as unknown as ImportedNutritionPlan;

  const normalized = normalizeImportedNutritionPlan(plan);
  assert.equal(normalized.days.length, 1);
  assert.equal(normalized.days[0]?.label, 'Training day');
  assert.deepEqual(
    normalized.days[0]?.meals.map((meal) => meal.name),
    ['Eggs', 'Steak'],
  );
});

test('an unknown meal type becomes a snack rather than failing the insert', () => {
  const plan = {
    days: [
      {
        dayIndex: 0,
        meals: [
          { mealType: 'BREAKFAST', name: 'Oats' },
          { mealType: 'second breakfast', name: 'More oats' },
          { mealType: 'post_workout', name: 'Shake' },
        ],
      },
    ],
  } as unknown as ImportedNutritionPlan;

  const normalized = normalizeImportedNutritionPlan(plan);
  assert.deepEqual(
    normalized.days[0]?.meals.map((meal) => meal.mealType),
    ['breakfast', 'snack', 'post_workout'],
  );
});

test('a meal with no name is dropped', () => {
  const plan = {
    days: [{ dayIndex: 0, meals: [{ mealType: 'lunch', name: '   ' }, { mealType: 'lunch', name: 'Chicken' }] }],
  } as unknown as ImportedNutritionPlan;

  const normalized = normalizeImportedNutritionPlan(plan);
  assert.equal(normalized.days[0]?.meals.length, 1);
  assert.equal(normalized.days[0]?.meals[0]?.name, 'Chicken');
});

test('macros that are not usable numbers are dropped rather than written as-is', () => {
  const plan = {
    days: [
      {
        dayIndex: 0,
        meals: [
          {
            mealType: 'lunch',
            name: 'Chicken',
            calories: Number.NaN,
            proteinG: -20,
            carbsG: Number.POSITIVE_INFINITY,
            fatG: 22.4,
          },
        ],
      },
    ],
  } as unknown as ImportedNutritionPlan;

  const meal = normalizeImportedNutritionPlan(plan).days[0]?.meals[0];
  assert.equal(meal?.calories, undefined);
  assert.equal(meal?.proteinG, undefined);
  assert.equal(meal?.carbsG, undefined);
  assert.equal(meal?.fatG, 22);
});

test('an absurd value is clamped instead of becoming the day target', () => {
  const plan = {
    goals: { calories: 9_999_999, proteinG: 500 },
    days: [{ dayIndex: 0, meals: [{ mealType: 'lunch', name: 'Chicken', calories: 999_999 }] }],
  } as unknown as ImportedNutritionPlan;

  const normalized = normalizeImportedNutritionPlan(plan);
  assert.equal(normalized.goals?.calories, 10_000);
  assert.equal(normalized.goals?.proteinG, 500);
  assert.equal(normalized.days[0]?.meals[0]?.calories, 5_000);
});

test('a day cannot carry an unbounded number of meals', () => {
  const meals = Array.from({ length: 40 }, (_, index) => ({ mealType: 'snack', name: `Snack ${index}` }));
  const plan = { days: [{ dayIndex: 0, meals }] } as unknown as ImportedNutritionPlan;

  assert.equal(normalizeImportedNutritionPlan(plan).days[0]?.meals.length, 12);
});

test('a plan with no usable targets reports no goals rather than empty ones', () => {
  const plan = { goals: { calories: 0, proteinG: 0 }, days: [] } as unknown as ImportedNutritionPlan;
  assert.equal(normalizeImportedNutritionPlan(plan).goals, undefined);
});

test('a goals-only plan keeps its targets', () => {
  const plan = { goals: { calories: 2200, proteinG: 200 }, days: [] } as unknown as ImportedNutritionPlan;
  const normalized = normalizeImportedNutritionPlan(plan);
  assert.equal(normalized.goals?.calories, 2200);
  assert.equal(normalized.days.length, 0);
});

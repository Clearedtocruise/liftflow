import assert from 'node:assert/strict';

import type { Meal } from '@/types';
import {
    aggregateWeeklyGroceries,
    GROCERY_AISLE_ORDER,
    groupGroceriesByCategory,
} from './groceryAggregation';

function baseMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    userId: 'user-1',
    mealType: 'breakfast',
    name: 'Custom meal',
    scheduledDate: '2026-07-13',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function mealWithIngredients(
  name: string,
  ingredients: Array<{ name: string; serving: string }>,
  overrides: Partial<Meal> = {},
): Meal {
  return baseMeal({
    name,
    instructions: JSON.stringify({ status: 'planned', ingredients }),
    ...overrides,
  });
}

function run() {
  // --- Category ordering ---------------------------------------------------
  assert.deepEqual(GROCERY_AISLE_ORDER, [
    'Produce',
    'Meat',
    'Dairy',
    'Frozen',
    'Pantry',
    'Spices',
    'Beverages',
    'Miscellaneous',
  ]);

  // --- Merge: same ingredient + unit across meals sums quantities ----------
  const mergeMeals = [
    mealWithIngredients('Chicken bowl', [{ name: 'Chicken breast', serving: '6 oz' }], {
      id: 'm1',
      scheduledDate: '2026-07-13',
    }),
    mealWithIngredients('Chicken wrap', [{ name: 'Chicken breast', serving: '4 oz' }], {
      id: 'm2',
      scheduledDate: '2026-07-14',
    }),
  ];
  const merged = aggregateWeeklyGroceries(mergeMeals);
  const chicken = merged.find((item) => item.name === 'Chicken breast');
  assert.ok(chicken, 'expected merged chicken breast entry');
  assert.equal(chicken?.quantity, '10 oz');
  assert.equal(chicken?.category, 'Meat');

  // --- Fractions parse and sum correctly ------------------------------------
  const fractionMeals = [
    mealWithIngredients('Oats bowl', [{ name: 'Rolled oats', serving: '1/2 cup' }], { id: 'm3' }),
    mealWithIngredients('Oats snack', [{ name: 'Rolled oats', serving: '1/4 cup' }], { id: 'm4' }),
  ];
  const fractionResult = aggregateWeeklyGroceries(fractionMeals);
  const oats = fractionResult.find((item) => item.name === 'Rolled oats');
  assert.equal(oats?.quantity, '0.8 cup');
  assert.equal(oats?.category, 'Pantry');

  // --- Category coverage across the eight aisles ----------------------------
  const categoryMeals = [
    mealWithIngredients('Aisle check', [
      { name: 'Broccoli', serving: '1 cup' },
      { name: 'Chicken breast', serving: '6 oz' },
      { name: 'Greek yogurt', serving: '1 cup' },
      { name: 'Frozen mixed berries', serving: '1 cup' },
      { name: 'White rice', serving: '1 cup' },
      { name: 'Cinnamon', serving: '1 tsp' },
      { name: 'Almond milk', serving: '8 oz' },
      { name: 'Whey protein', serving: '1 scoop' },
    ], { id: 'm5' }),
  ];
  const categorized = aggregateWeeklyGroceries(categoryMeals);
  const byName = new Map(categorized.map((item) => [item.name, item.category]));
  assert.equal(byName.get('Broccoli'), 'Produce');
  assert.equal(byName.get('Chicken breast'), 'Meat');
  assert.equal(byName.get('Greek yogurt'), 'Dairy');
  assert.equal(byName.get('Frozen mixed berries'), 'Frozen');
  assert.equal(byName.get('White rice'), 'Pantry');
  assert.equal(byName.get('Cinnamon'), 'Spices');
  assert.equal(byName.get('Almond milk'), 'Beverages');
  assert.equal(byName.get('Whey protein'), 'Miscellaneous');

  // Results should come back sorted by aisle order, not alphabetically.
  const aisleIndexes = categorized.map((item) => GROCERY_AISLE_ORDER.indexOf(item.category as never));
  const sortedCopy = [...aisleIndexes].sort((a, b) => a - b);
  assert.deepEqual(aisleIndexes, sortedCopy);

  const grouped = groupGroceriesByCategory(categorized);
  assert.deepEqual(Object.keys(grouped), [
    'Produce',
    'Meat',
    'Dairy',
    'Frozen',
    'Pantry',
    'Spices',
    'Beverages',
    'Miscellaneous',
  ]);

  // --- Nut butter should not be miscategorized as Dairy --------------------
  const nutButterResult = aggregateWeeklyGroceries([
    mealWithIngredients('Snack', [{ name: 'Almond butter', serving: '2 tbsp' }], { id: 'm6' }),
  ]);
  assert.equal(nutButterResult.find((item) => item.name === 'Almond butter')?.category, 'Pantry');

  // --- Servings scaling: default is 1x when servings is absent --------------
  const defaultServings = aggregateWeeklyGroceries([
    mealWithIngredients('Single serving', [{ name: 'Salmon fillet', serving: '6 oz' }], { id: 'm7' }),
  ]);
  assert.equal(defaultServings.find((item) => item.name === 'Salmon fillet')?.quantity, '6 oz');

  // --- Servings scaling: multiplies ingredient quantities -------------------
  const scaledServings = aggregateWeeklyGroceries([
    mealWithIngredients('Family batch', [{ name: 'Salmon fillet', serving: '6 oz' }], {
      id: 'm8',
      servings: 3,
    }),
  ]);
  assert.equal(scaledServings.find((item) => item.name === 'Salmon fillet')?.quantity, '18 oz');

  // --- Servings scaling combined with merging across meals ------------------
  const combinedScaling = aggregateWeeklyGroceries([
    mealWithIngredients('Meal prep A', [{ name: 'Quinoa', serving: '1 cup' }], {
      id: 'm9',
      servings: 2,
    }),
    mealWithIngredients('Meal prep B', [{ name: 'Quinoa', serving: '1 cup' }], {
      id: 'm10',
      servings: 1,
    }),
  ]);
  assert.equal(combinedScaling.find((item) => item.name === 'Quinoa')?.quantity, '3 cup');

  console.log('groceryAggregation.test.ts — PASS');
}

run();

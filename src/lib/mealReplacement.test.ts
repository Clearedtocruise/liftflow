import assert from 'node:assert/strict';

import type { Meal } from '@/types';
import { parseMealMeta } from './mealIngredients';
import {
    buildSmartIngredientReplacementUpdate,
    buildSmartMealReplacementUpdate,
} from './mealReplacement';

function baseMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    userId: 'user-1',
    mealType: 'breakfast',
    name: 'Greek yogurt bowl with berries',
    scheduledDate: '2026-07-14',
    calories: 320,
    proteinG: 28,
    carbsG: 30,
    fatG: 8,
    instructions: JSON.stringify({
      status: 'planned',
      ingredients: [
        { name: 'Greek yogurt', serving: '1 cup' },
        { name: 'Mixed berries', serving: '1/2 cup' },
      ],
    }),
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function run() {
  const multi = buildSmartMealReplacementUpdate(baseMeal(), {
    foodName: 'Greek yogurt, granola, honey',
    servingSize: '3 items',
    macros: { calories: 410, proteinG: 32, carbsG: 48, fatG: 12 },
    items: [
      { foodName: 'Greek yogurt', servingSize: '1 cup', macros: { calories: 150, proteinG: 20, carbsG: 8, fatG: 4 } },
      { foodName: 'Granola', servingSize: '1/3 cup', macros: { calories: 180, proteinG: 5, carbsG: 28, fatG: 6 } },
      { foodName: 'Honey', servingSize: '1 tbsp', macros: { calories: 80, proteinG: 0, carbsG: 22, fatG: 0 } },
    ],
  });

  assert.equal(multi.name, 'Greek yogurt, granola, honey');
  assert.equal(multi.calories, 410);
  assert.equal(multi.proteinG, 32);
  assert.equal(multi.carbsG, 48);
  assert.equal(multi.fatG, 12);

  const meta = parseMealMeta(multi.instructions);
  assert.equal(meta.status, 'modified');
  assert.deepEqual(meta.ingredients, [
    { name: 'Greek yogurt', serving: '1 cup' },
    { name: 'Granola', serving: '1/3 cup' },
    { name: 'Honey', serving: '1 tbsp' },
  ]);

  const single = buildSmartMealReplacementUpdate(baseMeal(), {
    foodName: 'Lean Ground Beef',
    servingSize: '6 oz',
    macros: { calories: 250, proteinG: 30, carbsG: 0, fatG: 14 },
  });
  assert.equal(single.name, 'Lean Ground Beef');
  assert.deepEqual(parseMealMeta(single.instructions).ingredients, [
    { name: 'Lean Ground Beef', serving: '6 oz' },
  ]);

  const ingredientSwap = buildSmartIngredientReplacementUpdate(baseMeal(), 'Mixed berries', {
    foodName: 'Blueberries',
    servingSize: '1 cup',
    macros: { calories: 85, proteinG: 1, carbsG: 21, fatG: 0 },
  });
  const swapped = parseMealMeta(ingredientSwap.instructions).ingredients ?? [];
  assert.equal(swapped.length, 2);
  assert.deepEqual(
    swapped.find((item) => item.name === 'Blueberries'),
    { name: 'Blueberries', serving: '1 cup' },
  );
  assert.ok(swapped.some((item) => item.name === 'Greek yogurt'));

  console.log('mealReplacement.test.ts — PASS');
}

run();

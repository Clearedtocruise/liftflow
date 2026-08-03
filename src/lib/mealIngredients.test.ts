import assert from 'node:assert/strict';
import test from 'node:test';

import { looksLikeInflatedMealMacros, resolveMealMacros } from './mealIngredients';

test('resolveMealMacros corrects inflated Oikos peanut butter snack', () => {
  const meal = {
    name: 'Oikos Triple Zero, Blueberries, 2 Tablespoons Peanut Butter with 3 Tablespoons Peanuts',
    calories: 852,
    proteinG: 35,
    carbsG: 30,
    fatG: 73,
    macrosProvided: true,
    instructions: JSON.stringify({
      status: 'completed',
      ingredients: [
        { name: 'oikos triple zero, blueberries, 2 tablespoons peanut butter', serving: '1' },
        { name: '3 tablespoons peanuts', serving: '1' },
      ],
    }),
  };

  const estimated = resolveMealMacros({ ...meal, macrosProvided: false });
  assert.equal(looksLikeInflatedMealMacros(meal, estimated), true);

  const macros = resolveMealMacros(meal);
  assert.ok(macros.calories < 550, `expected corrected calories, got ${macros.calories}`);
  assert.ok(macros.fatG < 45, `expected corrected fat, got ${macros.fatG}`);
  assert.ok(macros.calories > 200, `expected a real snack, got ${macros.calories}`);
});

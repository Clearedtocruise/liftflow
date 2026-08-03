import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSmartIngredientReplacementUpdate,
  buildSmartMealReplacementUpdate,
} from './mealReplacement';
import { parseMealMeta } from './mealIngredients';
import type { Meal } from '@/types';

function baseMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    userId: 'user-1',
    mealType: 'dinner',
    name: 'Salmon with roasted vegetables',
    scheduledDate: '2026-07-28',
    calories: 700,
    proteinG: 45,
    carbsG: 35,
    fatG: 28,
    status: 'planned',
    origin: 'plan',
    createdAt: '2026-07-28T12:00:00.000Z',
    ...overrides,
  };
}

function countsTowardHomeProtein(status: Meal['status']): boolean {
  return status === 'completed' || status === 'modified';
}

test('smart meal replace stays planned so protein does not count yet', () => {
  const update = buildSmartMealReplacementUpdate(baseMeal(), {
    foodName: 'Turkey rice bowl',
    servingSize: '1 serving',
    macros: { calories: 600, proteinG: 46, carbsG: 58, fatG: 12 },
  });

  assert.equal(update.status, 'planned');
  assert.equal(parseMealMeta(update.instructions).status, 'planned');
  assert.equal(countsTowardHomeProtein(update.status), false);
});

test('smart ingredient replace stays planned so protein does not count yet', () => {
  const meal = baseMeal({
    instructions: JSON.stringify({
      status: 'planned',
      ingredients: [
        { name: 'Salmon fillet', serving: '6 oz' },
        { name: 'Mixed vegetables', serving: '2 cups' },
      ],
    }),
  });
  const update = buildSmartIngredientReplacementUpdate(meal, 'Salmon fillet', {
    foodName: 'Chicken breast',
    servingSize: '6 oz',
    macros: { calories: 280, proteinG: 52, carbsG: 0, fatG: 6 },
  });

  assert.equal(update.status, 'planned');
  assert.equal(parseMealMeta(update.instructions).status, 'planned');
  assert.equal(countsTowardHomeProtein(update.status), false);
});

test('ate as planned and modified still count toward home protein', () => {
  assert.equal(countsTowardHomeProtein('completed'), true);
  assert.equal(countsTowardHomeProtein('modified'), true);
  assert.equal(countsTowardHomeProtein('planned'), false);
  assert.equal(countsTowardHomeProtein('skipped'), false);
});

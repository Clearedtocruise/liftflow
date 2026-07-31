import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeMealName,
  resolveUsualMeals,
  tallyMealDefaults,
  USUAL_MEAL_THRESHOLD,
  usualMealSuggestion,
} from './mealDefaults';
import type { MealType } from '@/types/common';
import type { Meal } from '@/types/nutrition';

const now = new Date('2026-07-31T12:00:00Z');

function meal(
  scheduledDate: string,
  mealType: MealType,
  name: string,
  status: Meal['status'] = 'completed',
  macros?: { calories?: number; proteinG?: number },
): Meal {
  return {
    id: `${scheduledDate}-${mealType}-${name}`,
    createdAt: `${scheduledDate}T08:00:00Z`,
    userId: 'u1',
    mealType,
    name,
    scheduledDate,
    status,
    origin: 'plan',
    consumedAt: `${scheduledDate}T08:05:00Z`,
    macrosProvided: true,
    calories: macros?.calories,
    proteinG: macros?.proteinG,
  } as Meal;
}

test('a meal eaten on three separate days becomes the usual', () => {
  const meals = [
    meal('2026-07-29', 'breakfast', 'Greek yogurt + berries'),
    meal('2026-07-30', 'breakfast', 'Greek yogurt + berries'),
    meal('2026-07-31', 'breakfast', 'Greek yogurt + berries'),
  ];

  const usual = resolveUsualMeals(meals, { now });
  assert.equal(usual.get('breakfast')?.name, 'Greek yogurt + berries');
  assert.equal(usual.get('breakfast')?.useCount, USUAL_MEAL_THRESHOLD);
});

test('one repeat is not a habit', () => {
  const meals = [
    meal('2026-07-30', 'breakfast', 'Greek yogurt + berries'),
    meal('2026-07-31', 'breakfast', 'Greek yogurt + berries'),
  ];
  assert.equal(resolveUsualMeals(meals, { now }).has('breakfast'), false);
});

test('logging the same meal twice in one day counts once', () => {
  const twiceToday = [
    meal('2026-07-31', 'breakfast', 'Oats'),
    { ...meal('2026-07-31', 'breakfast', 'Oats'), id: 'dupe' },
    meal('2026-07-30', 'breakfast', 'Oats'),
  ];
  const tally = tallyMealDefaults(twiceToday, { now });
  assert.equal(tally[0].useCount, 2);
});

test('spelling drift does not split the count', () => {
  assert.equal(normalizeMealName('Greek Yogurt + Berries'), normalizeMealName('greek yogurt  berries'));

  const meals = [
    meal('2026-07-29', 'lunch', 'Chicken & Rice'),
    meal('2026-07-30', 'lunch', 'chicken and rice'.replace(' and ', ' & ')),
    meal('2026-07-31', 'lunch', 'Chicken &  Rice'),
  ];
  assert.equal(resolveUsualMeals(meals, { now }).get('lunch')?.useCount, 3);
});

test('skipped and planned meals never become the usual', () => {
  const meals = [
    meal('2026-07-29', 'dinner', 'Salmon', 'skipped'),
    meal('2026-07-30', 'dinner', 'Salmon', 'planned'),
    meal('2026-07-31', 'dinner', 'Salmon', 'skipped'),
  ];
  assert.equal(resolveUsualMeals(meals, { now }).has('dinner'), false);
});

test('a modified meal still counts as eaten', () => {
  const meals = [
    meal('2026-07-29', 'dinner', 'Steak bowl', 'modified'),
    meal('2026-07-30', 'dinner', 'Steak bowl', 'completed'),
    meal('2026-07-31', 'dinner', 'Steak bowl', 'modified'),
  ];
  assert.equal(resolveUsualMeals(meals, { now }).get('dinner')?.name, 'Steak bowl');
});

test('old habits fall out of the window', () => {
  const stale = ['2026-01-01', '2026-01-02', '2026-01-03'].map((d) =>
    meal(d, 'breakfast', 'Pancakes'),
  );
  assert.equal(resolveUsualMeals(stale, { now }).has('breakfast'), false);
});

test('the usual keeps the most recent macros', () => {
  const meals = [
    meal('2026-07-29', 'lunch', 'Burrito bowl', 'completed', { calories: 600, proteinG: 40 }),
    meal('2026-07-30', 'lunch', 'Burrito bowl', 'completed', { calories: 650, proteinG: 45 }),
    meal('2026-07-31', 'lunch', 'Burrito bowl', 'completed', { calories: 700, proteinG: 50 }),
  ];
  const usual = resolveUsualMeals(meals, { now }).get('lunch');
  assert.equal(usual?.calories, 700);
  assert.equal(usual?.proteinG, 50);
});

test('the suggestion only appears when the plan differs and nothing is logged yet', () => {
  const meals = ['2026-07-29', '2026-07-30', '2026-07-31'].map((d) =>
    meal(d, 'breakfast', 'Greek yogurt + berries'),
  );
  const usual = resolveUsualMeals(meals, { now });

  const planned = { mealType: 'breakfast' as MealType, name: 'Egg white omelette', status: 'planned' as const };
  assert.equal(usualMealSuggestion(planned, usual)?.name, 'Greek yogurt + berries');

  // Already the usual — nothing to suggest.
  const sameAsUsual = { mealType: 'breakfast' as MealType, name: 'greek yogurt + berries', status: 'planned' as const };
  assert.equal(usualMealSuggestion(sameAsUsual, usual), undefined);

  // Already eaten — the choice has been made.
  const eaten = { mealType: 'breakfast' as MealType, name: 'Egg white omelette', status: 'completed' as const };
  assert.equal(usualMealSuggestion(eaten, usual), undefined);
});

test('each slot learns its own usual', () => {
  const meals = [
    ...['2026-07-29', '2026-07-30', '2026-07-31'].map((d) => meal(d, 'breakfast', 'Oats')),
    ...['2026-07-29', '2026-07-30', '2026-07-31'].map((d) => meal(d, 'dinner', 'Salmon + rice')),
  ];
  const usual = resolveUsualMeals(meals, { now });
  assert.equal(usual.get('breakfast')?.name, 'Oats');
  assert.equal(usual.get('dinner')?.name, 'Salmon + rice');
});

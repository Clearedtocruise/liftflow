import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateDailyMeals, aggregateWeeklyMeals, roundedMealMacros } from './mealAggregation';
import type { MealType } from '@/types/common';
import type { Meal } from '@/types/nutrition';

function meal(
  mealType: MealType,
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number },
  overrides: Partial<Meal> = {},
): Meal {
  return {
    id: `meal-${mealType}`,
    userId: 'u',
    name: `Logged ${mealType}`,
    mealType,
    status: 'completed',
    origin: 'log',
    macrosProvided: true,
    scheduledDate: '2026-10-14',
    createdAt: '2026-10-14T12:00:00Z',
    ...macros,
    ...overrides,
  } as unknown as Meal;
}

// The day from the report: cards read 35, 31, 34, 0, 19 and 50 g, which add up to 169, while the
// stored values carry decimals that summed to 171 before being rounded once at the end.
const reportedDay = [
  meal('pre_workout', { calories: 288, proteinG: 35.4, carbsG: 10, fatG: 11 }),
  meal('breakfast', { calories: 413, proteinG: 31.4, carbsG: 42, fatG: 16 }),
  meal('snack', { calories: 410, proteinG: 34.4, carbsG: 34, fatG: 14 }),
  meal('lunch', { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }),
  meal('post_workout', { calories: 489, proteinG: 19.4, carbsG: 65, fatG: 17 }),
  meal('dinner', { calories: 535, proteinG: 50.4, carbsG: 46, fatG: 17 }),
];

test('the protein total is the sum of the protein the cards print', () => {
  const shownOnCards = reportedDay.map((m) => roundedMealMacros(m).proteinG);
  assert.deepEqual(shownOnCards, [35, 31, 34, 0, 19, 50]);

  const total = aggregateDailyMeals(reportedDay).proteinG;
  assert.equal(total, 169);
  assert.equal(total, shownOnCards.reduce((sum, grams) => sum + grams, 0));
});

test('rounding once at the end is what produced the extra grams', () => {
  const exact = reportedDay.reduce((sum, m) => sum + (m.proteinG ?? 0), 0);
  assert.equal(Math.round(exact), 171);
  assert.notEqual(aggregateDailyMeals(reportedDay).proteinG, Math.round(exact));
});

test('carbs, fat and calories follow the same rule', () => {
  const day = aggregateDailyMeals([
    meal('breakfast', { calories: 100, proteinG: 10, carbsG: 10.4, fatG: 5.4 }),
    meal('lunch', { calories: 100, proteinG: 10, carbsG: 10.4, fatG: 5.4 }),
    meal('dinner', { calories: 100, proteinG: 10, carbsG: 10.4, fatG: 5.4 }),
  ]);
  assert.equal(day.carbsG, 30);
  assert.equal(day.fatG, 15);
  assert.equal(day.caloriesConsumed, 300);
});

test('half grams round up on each meal, as the cards do', () => {
  const day = aggregateDailyMeals([
    meal('breakfast', { calories: 100, proteinG: 20.5, carbsG: 0, fatG: 0 }),
    meal('lunch', { calories: 100, proteinG: 20.5, carbsG: 0, fatG: 0 }),
  ]);
  assert.equal(day.proteinG, 42);
});

test('meals not yet eaten are not counted, but are in the planned total', () => {
  const day = aggregateDailyMeals([
    meal('breakfast', { calories: 400, proteinG: 30.4, carbsG: 0, fatG: 0 }),
    meal('lunch', { calories: 500, proteinG: 40.4, carbsG: 0, fatG: 0 }, { status: 'planned' } as Partial<Meal>),
  ]);
  assert.equal(day.proteinG, 30);
  assert.equal(day.plannedProteinG, 70);
  assert.equal(day.mealsCompleted, 1);
});

test('the week total is the sum of its rounded days', () => {
  const week = aggregateWeeklyMeals([
    ...reportedDay,
    ...reportedDay.map((m) => ({ ...m, id: `${m.id}-2`, scheduledDate: '2026-10-15' }) as Meal),
  ]);
  assert.equal(week.proteinG, 338);
});

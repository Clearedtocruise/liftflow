import assert from 'node:assert/strict';
import test from 'node:test';

import { generateWeeklyMealPlanMeals, selectDailyCoreMeals } from './mealPlanTemplates.js';

test('rotates breakfast names across the week', () => {
  const meals = generateWeeklyMealPlanMeals(180, 2400, 'balanced', '2026-06-15');
  const breakfasts = meals.filter((meal) => meal.mealType === 'breakfast').map((meal) => meal.name);
  assert.ok(new Set(breakfasts).size > 1);
  assert.equal(breakfasts.length, 7);
});

test('returns different core meals for different dates', () => {
  const macros = { calories: 2400, proteinG: 180, carbsG: 240, fatG: 67 };
  const monday = selectDailyCoreMeals('2026-06-15', macros, 'balanced');
  const tuesday = selectDailyCoreMeals('2026-06-16', macros, 'balanced');
  assert.notEqual(monday[0]?.name, tuesday[0]?.name);
});

test('generates 42 meals for a full week', () => {
  const meals = generateWeeklyMealPlanMeals();
  assert.equal(meals.length, 42);
});

import { describe, expect, it } from 'vitest';

import { generateWeeklyMealPlanMeals, selectDailyCoreMeals } from './mealPlanTemplates.js';

describe('mealPlanTemplates', () => {
  it('rotates breakfast names across the week', () => {
    const meals = generateWeeklyMealPlanMeals(180, 2400, 'balanced', '2026-06-15');
    const breakfasts = meals.filter((meal) => meal.mealType === 'breakfast').map((meal) => meal.name);
    const unique = new Set(breakfasts);
    expect(unique.size).toBeGreaterThan(1);
    expect(breakfasts.length).toBe(7);
  });

  it('returns different core meals for different dates', () => {
    const macros = { calories: 2400, proteinG: 180, carbsG: 240, fatG: 67 };
    const monday = selectDailyCoreMeals('2026-06-15', macros, 'balanced');
    const tuesday = selectDailyCoreMeals('2026-06-16', macros, 'balanced');
    expect(monday[0]?.name).not.toBe(tuesday[0]?.name);
  });

  it('generates 42 meals for a full week', () => {
    const meals = generateWeeklyMealPlanMeals();
    expect(meals).toHaveLength(42);
  });
});

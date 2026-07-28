import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateMacroTargets, normalizeBodyWeightKg } from './workoutAwareNutrition.js';
import { generateWeeklyMealPlanMeals } from './mealPlanTemplates.js';

test('normalizeBodyWeightKg undoes lbs multiplied by 2.2', () => {
  // ~182 lb wrongly stored as 402 kg → true ~83 kg
  assert.ok(Math.abs(normalizeBodyWeightKg(402.2) - 82.8) < 0.5);
  assert.equal(normalizeBodyWeightKg(85), 85);
  assert.equal(normalizeBodyWeightKg(undefined), 75);
});

test('fat-loss macros for mis-stored ~402 kg no longer yield 3392-cal dinners', () => {
  const macros = calculateMacroTargets({ goal: 'fat_loss', bodyWeightKg: 402.2 });
  assert.ok(macros.calories <= 3500, `daily calories ${macros.calories}`);
  assert.ok(macros.proteinG < 220, `protein ${macros.proteinG}`);

  const meals = generateWeeklyMealPlanMeals(macros.proteinG, macros.calories, 'balanced', '2026-07-20', {
    foodPreferences: ['beef'],
  });
  const dinner = meals.find(
    (meal) => meal.mealType === 'dinner' && /lean beef with roasted/i.test(meal.name),
  );
  assert.ok(dinner, 'expected lean beef dinner');
  assert.ok(dinner!.calories < 1000, `dinner calories ${dinner!.calories}`);
  assert.ok(dinner!.proteinG < 80, `dinner protein ${dinner!.proteinG}`);
  // Must not match the screenshot bug (3392 / 266P).
  assert.notEqual(dinner!.calories, 3392);
  assert.notEqual(dinner!.proteinG, 266);
});

test('inflated daily calories passed to meal plan are capped before dinner split', () => {
  const meals = generateWeeklyMealPlanMeals(887, 11307, 'balanced', '2026-07-20', {
    foodPreferences: ['beef'],
  });
  const dinner = meals.find((meal) => meal.mealType === 'dinner')!;
  assert.ok(dinner.calories <= 4500 * 0.3 + 1, `got ${dinner.calories}`);
  assert.ok(dinner.calories < 2000, `got ${dinner.calories}`);
});

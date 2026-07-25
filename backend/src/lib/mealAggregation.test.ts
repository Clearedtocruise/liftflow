import assert from 'node:assert/strict';

import {
  aggregateDailyMeals,
  aggregateWeeklyMeals,
  countNutritionLogDays,
  type MealRow,
} from './mealAggregation.js';

function meal(partial: Partial<MealRow> & Pick<MealRow, 'id' | 'scheduled_date' | 'meal_type'>): MealRow {
  return {
    calories: 400,
    protein_g: 30,
    carbs_g: 35,
    fat_g: 12,
    instructions: null,
    created_at: '2026-06-01T08:00:00Z',
    ...partial,
  };
}

function run() {
  const today = '2026-06-10';

  // Duplicate rows: only completed keeper counts once.
  const duplicateDay = aggregateDailyMeals([
    meal({
      id: 'a1',
      scheduled_date: today,
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'planned' }),
    }),
    meal({
      id: 'a2',
      scheduled_date: today,
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'completed' }),
      created_at: '2026-06-01T09:00:00Z',
    }),
  ]);
  assert.equal(duplicateDay.caloriesConsumed, 450);
  assert.equal(duplicateDay.proteinG, 35);
  assert.equal(duplicateDay.mealsTotal, 1);

  // Planned meals do not count until completed/modified.
  const plannedOnly = aggregateDailyMeals([
    meal({
      id: 'b1',
      scheduled_date: today,
      meal_type: 'lunch',
      meal_plan_id: 'plan-1',
      calories: 650,
      protein_g: 50,
      instructions: JSON.stringify({ status: 'planned' }),
    }),
  ]);
  assert.equal(plannedOnly.caloriesConsumed, 0);
  assert.equal(plannedOnly.plannedCalories, 650);

  // Manual/ad-hoc logs count immediately; planned rows without a plan id do not.
  const manualLog = aggregateDailyMeals([
    meal({
      id: 'c1',
      scheduled_date: today,
      meal_type: 'snack',
      meal_plan_id: null,
      origin: 'log',
      status: 'completed',
      calories: 220,
      protein_g: 6,
    }),
  ]);
  assert.equal(manualLog.caloriesConsumed, 220);

  const unplannedPlanRow = aggregateDailyMeals([
    meal({
      id: 'c2',
      scheduled_date: today,
      meal_type: 'snack',
      meal_plan_id: null,
      origin: 'plan',
      status: 'planned',
      calories: 220,
      protein_g: 6,
    }),
  ]);
  assert.equal(unplannedPlanRow.caloriesConsumed, 0);

  // Two distinct snacks on the same day are both kept — not deduped away.
  const twoSnacks = aggregateDailyMeals([
    meal({
      id: 'c3',
      scheduled_date: today,
      meal_type: 'snack',
      meal_plan_id: null,
      origin: 'log',
      status: 'completed',
      calories: 150,
      protein_g: 5,
    }),
    meal({
      id: 'c4',
      scheduled_date: today,
      meal_type: 'snack',
      meal_plan_id: null,
      origin: 'log',
      status: 'completed',
      calories: 200,
      protein_g: 8,
    }),
  ]);
  assert.equal(twoSnacks.caloriesConsumed, 350);

  // Weekly totals sum deduped daily totals.
  const week = aggregateWeeklyMeals([
    meal({
      id: 'd1',
      scheduled_date: today,
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'completed' }),
    }),
    meal({
      id: 'd2',
      scheduled_date: '2026-06-11',
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'completed' }),
    }),
  ]);
  assert.equal(week.caloriesConsumed, 900);
  assert.equal(week.proteinG, 70);
  assert.equal(Object.keys(week.byDate).length, 2);

  // Adherence counts days with consumed meals, not raw row count.
  const logDays = countNutritionLogDays([
    meal({
      id: 'e1',
      scheduled_date: today,
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'completed' }),
    }),
    meal({
      id: 'e2',
      scheduled_date: today,
      meal_type: 'breakfast',
      meal_plan_id: 'plan-1',
      calories: 450,
      protein_g: 35,
      instructions: JSON.stringify({ status: 'planned' }),
    }),
    meal({
      id: 'e3',
      scheduled_date: '2026-06-09',
      meal_type: 'lunch',
      meal_plan_id: 'plan-1',
      calories: 650,
      protein_g: 50,
      instructions: JSON.stringify({ status: 'planned' }),
    }),
  ]);
  assert.equal(logDays, 1);

  console.log('mealAggregation tests: 5/5 PASS');
}

run();

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AGGRESSIVE_CUT_NUTRITION_DAYS, AGGRESSIVE_CUT_NUTRITION_GOALS } from './aggressiveCutMeals.js';
import { AGGRESSIVE_CUT_WORKOUT_DAYS } from './aggressiveCutWorkouts.js';

test('aggressive cut workout week is six lift days with the PDF day labels', () => {
  assert.equal(AGGRESSIVE_CUT_WORKOUT_DAYS.length, 6);
  assert.deepEqual(
    AGGRESSIVE_CUT_WORKOUT_DAYS.map((d) => d.label),
    [
      'Back + Rear Delts',
      'Chest + Triceps',
      'Legs',
      'Shoulders + Chest Volume',
      'Back + Arms',
      'Legs + Abs',
    ],
  );
  assert.ok(AGGRESSIVE_CUT_WORKOUT_DAYS.every((d) => d.exercises.length >= 5));
  const day1 = AGGRESSIVE_CUT_WORKOUT_DAYS[0];
  assert.equal(day1.exercises[0]?.name, 'Pull-Up');
  assert.equal(day1.exercises[0]?.sets, 5);
  assert.equal(day1.exercises[0]?.reps, '5');
});

test('aggressive cut nutrition covers seven days and keeps protein high', () => {
  assert.equal(AGGRESSIVE_CUT_NUTRITION_DAYS.length, 7);
  assert.equal(AGGRESSIVE_CUT_NUTRITION_GOALS.proteinG, 210);
  for (const day of AGGRESSIVE_CUT_NUTRITION_DAYS) {
    const protein = day.meals.reduce((sum, meal) => sum + meal.proteinG, 0);
    assert.ok(protein >= 160, `day ${day.dayIndex} protein too low: ${protein}`);
    assert.ok(day.meals.every((meal) => meal.scheduledTime), `day ${day.dayIndex} missing meal times`);
  }
});

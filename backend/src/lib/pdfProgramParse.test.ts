import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { heuristicParseProgramText } from './pdfProgramParse.js';
import { importedNutritionToMealPlanResponse } from './importedNutritionPlan.js';

describe('pdfProgramParse heuristic', () => {
  it('extracts a multi-day workout cycle from plain text', () => {
    const text = `
My Push Pull Program

Day 1 — Push
Bench Press 4x8
Overhead Press 3x10
Tricep Pushdown 3x12

Day 2 Rest

Day 3 — Pull
Pull-Up 5x5
Barbell Row 4x8
`;
    const preview = heuristicParseProgramText(text, 'workout');
    assert.ok(preview.workout);
    assert.equal(preview.workout!.lengthDays, 3);
    assert.equal(preview.workout!.days[0].isRest, false);
    assert.ok(preview.workout!.days[0].exercises.some((e) => /bench/i.test(e.name)));
    assert.equal(preview.workout!.days[1].isRest, true);
    assert.ok(preview.workout!.days[2].exercises.some((e) => /pull/i.test(e.name)));
    assert.equal(preview.nutrition, null);
  });

  it('extracts nutrition calorie/protein targets', () => {
    const text = 'Eat 2100 calories with 180g protein daily. Stay hydrated.';
    const preview = heuristicParseProgramText(text, 'nutrition');
    assert.equal(preview.workout, null);
    assert.ok(preview.nutrition?.goals?.calories === 2100);
    assert.ok(preview.nutrition?.goals?.proteinG === 180);
  });

  it('both kind can return workout without inventing nutrition meals', () => {
    const text = `Day 1\nSquat 5x5\nDay 2\nBench 5x5`;
    const preview = heuristicParseProgramText(text, 'both');
    assert.ok(preview.workout);
    assert.equal(preview.workout!.days.length, 2);
  });
});

describe('importedNutritionToMealPlanResponse', () => {
  it('maps dayIndex onto week dates', () => {
    const plan = importedNutritionToMealPlanResponse(
      {
        name: 'Test',
        days: [
          {
            dayIndex: 0,
            meals: [
              {
                mealType: 'breakfast',
                name: 'Eggs',
                calories: 400,
                proteinG: 30,
                carbsG: 20,
                fatG: 20,
              },
            ],
          },
          {
            dayIndex: 2,
            meals: [{ mealType: 'lunch', name: 'Chicken', calories: 500, proteinG: 40 }],
          },
        ],
      },
      '2026-08-24',
    );
    assert.equal(plan.weekStartDate, '2026-08-24');
    assert.equal(plan.meals.length, 2);
    assert.equal(plan.meals[0].scheduledDate, '2026-08-24');
    assert.equal(plan.meals[1].scheduledDate, '2026-08-26');
    assert.equal(plan.aiGenerated, false);
  });
});

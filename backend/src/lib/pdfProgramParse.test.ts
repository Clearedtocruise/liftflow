import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { heuristicParseProgramText, normalizePlanText } from './pdfProgramParse.js';
import { importedNutritionToMealPlanResponse } from './importedNutritionPlan.js';

describe('normalizePlanText', () => {
  it('breaks a collapsed multi-day paste into separate day lines', () => {
    const collapsed =
      'Day 1 — Push Bench Press 4x8 Overhead Press 3x10 Day 2 — Pull Pull-Up 5x5 Barbell Row 4x8 Day 3 — Legs Squat 5x5';
    const normalized = normalizePlanText(collapsed);
    assert.match(normalized, /^Day 1/m);
    assert.match(normalized, /^Day 2/m);
    assert.match(normalized, /^Day 3/m);
    assert.ok(normalized.split('\n').length >= 3);
  });
});

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

  it('extracts all six days from a collapsed one-line paste (the reported bug)', () => {
    const text =
      'Day 1 — Push Bench Press 4x8 Overhead Press 3x10 Day 2 — Pull Pull-Up 5x5 Barbell Row 4x8 Day 3 — Legs Squat 5x5 RDL 3x8 Day 4 — Push Incline Bench 4x8 Lateral Raise 3x15 Day 5 — Pull Chin-Up 4x6 Seated Row 4x10 Day 6 — Legs Front Squat 4x6 Walking Lunges 3x10 each Leg Curl 3x12';
    const preview = heuristicParseProgramText(text, 'workout');
    assert.ok(preview.workout, 'expected a workout preview');
    assert.equal(preview.workout!.lengthDays, 6);
    assert.equal(preview.workout!.days.filter((d) => !d.isRest).length, 6);
    assert.ok(preview.workout!.days[0].exercises.some((e) => /bench/i.test(e.name)));
    assert.ok(preview.workout!.days[1].exercises.some((e) => /pull/i.test(e.name)));
    assert.ok(preview.workout!.days[5].exercises.some((e) => /squat|leg curl|lunges/i.test(e.name)));
    assert.ok(
      preview.workout!.days[5].exercises.some((e) => /leg curl/i.test(e.name)),
      'Leg Curl after "each" must not be swallowed into Walking Lunges',
    );
    // Every imported lift gets the standard 90s rest when the paste omits rest.
    assert.ok(preview.workout!.days[0].exercises.every((e) => e.restSeconds === 90));
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

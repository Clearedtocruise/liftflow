import assert from 'node:assert/strict';
import test from 'node:test';

import { withDeadline } from './pdfProgramImport.js';
import { detectNutritionGoals } from './pdfProgramParse.js';

const PLAN_TEXT = `
Goal: 180 lb. Train to preserve muscle and strength while gradually losing fat.
Small carbohydrate snack; optional protein if tolerated. Banana plus 1/2-1
scoop whey in water, or toast and a small protein shake.
Start around 2,300 calories daily. This is a trial target, not a measured maintenance requirement.
Calories About 2,300 kcal
Protein 170 g
Carbohydrates 260 g
Fat 65 g
These macros total approximately 2,305 calories; small rounding differences are normal.
Protein: Aim for 170 g daily (about 2.0 g/kg at 187 lb), divided across 4-5 meals or snacks.
A scoop of whey is assumed to provide about 120 calories and 24 g protein;
Dates: Oct 10, 17, 24, 31; Nov 7 | About 2,300 calories / 180 g protein
Dates: Oct 11, 18, 25; Nov 1, 8 | About 2,350 calories / 185 g protein
`;

test('the stated daily targets are read, not the first food label in the document', () => {
  assert.deepEqual(detectNutritionGoals(PLAN_TEXT), {
    calories: 2300,
    proteinG: 170,
    carbsG: 260,
    fatG: 65,
  });
});

test('food-label numbers are never taken for daily targets', () => {
  const goals = detectNutritionGoals('A scoop of whey is about 120 calories and 24 g protein. Rice: 200 calories.');
  assert.equal(goals.calories, undefined);
  assert.equal(goals.proteinG, undefined);
});

test('a document with no targets yields no goals instead of a guess', () => {
  assert.deepEqual(detectNutritionGoals('Day 1 - Push\nBench Press 4x8'), {
    calories: undefined,
    proteinG: undefined,
    carbsG: undefined,
    fatG: undefined,
  });
});

test('a read that never finishes is cut off with the reason instead of hanging', async () => {
  const started = Date.now();
  await assert.rejects(
    withDeadline(new Promise(() => undefined), 50, 'took too long'),
    /took too long/,
  );
  assert.ok(Date.now() - started < 1000);
});

test('a read that finishes in time passes straight through', async () => {
  assert.equal(await withDeadline(Promise.resolve('plan'), 500, 'took too long'), 'plan');
});

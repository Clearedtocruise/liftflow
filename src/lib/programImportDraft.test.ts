import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMeal,
  describeImportDraft,
  importDraftIssue,
  importDraftToPreview,
  previewToImportDraft,
  removeMeal,
  setNutritionDayLabel,
  setNutritionGoal,
  setWorkoutDays,
  stripDayOrdinal,
  updateMeal,
} from './programImportDraft';
import { setDayLabel, toggleRestDay } from './programCycleEditor';
import type { ProgramImportPreview } from '@/types/programImport';

function preview(): ProgramImportPreview {
  return {
    kind: 'both',
    title: 'Aggressive Cut',
    summary: 'parsed from pdf',
    pageCount: 4,
    workout: {
      name: 'Aggressive Cut',
      lengthDays: 3,
      days: [
        {
          label: 'Day 1 — Push',
          isRest: false,
          exercises: [{ name: 'Bench Press', sets: 4, repRange: '6-8', restSeconds: 120 }],
        },
        { label: 'Day 2 — Pull', isRest: false, exercises: [{ name: 'Barbell Row', sets: 4, repRange: '8' }] },
        { label: 'Rest', isRest: true, exercises: [] },
      ],
    },
    nutrition: {
      name: 'Cut Nutrition',
      goals: { calories: 2200, proteinG: 200 },
      days: [
        {
          dayIndex: 0,
          meals: [
            { mealType: 'breakfast', name: 'Eggs and oats', calories: 500, proteinG: 40 },
            { mealType: 'lunch', name: 'Chicken and rice', calories: 700, proteinG: 60 },
          ],
        },
      ],
    },
    warnings: ['Parsed without AI — review carefully'],
  };
}

test('the day ordinal the parser repeats in the label is stripped', () => {
  assert.equal(stripDayOrdinal('Day 1 — Push'), 'Push');
  assert.equal(stripDayOrdinal('Day 12: Legs'), 'Legs');
  assert.equal(stripDayOrdinal('Push'), 'Push');
  assert.equal(stripDayOrdinal(undefined), '');
});

test('a preview becomes an editable draft without losing anything', () => {
  const draft = previewToImportDraft(preview());

  assert.equal(draft.workout?.days.length, 3);
  assert.equal(draft.workout?.days[0]?.label, 'Push');
  assert.equal(draft.workout?.days[0]?.exercises[0]?.name, 'Bench Press');
  assert.equal(draft.workout?.days[0]?.exercises[0]?.sets, 4);
  assert.equal(draft.workout?.days[0]?.exercises[0]?.reps, '6-8');
  assert.equal(draft.workout?.days[2]?.isRest, true);

  assert.equal(draft.nutrition?.days[0]?.meals.length, 2);
  assert.equal(draft.nutrition?.goals.calories, 2200);
  // A parsed nutrition day carries no label, so it falls back to the weekday it maps onto.
  assert.equal(draft.nutrition?.days[0]?.label, 'Monday');
});

test('edits survive the round trip back into a preview the commit endpoint accepts', () => {
  const original = preview();
  let draft = previewToImportDraft(original);

  draft = setWorkoutDays(draft, setDayLabel(draft.workout!.days, 0, 'Chest Day'));
  draft = setNutritionGoal(draft, 'calories', 2400);
  draft = setNutritionDayLabel(draft, 0, 'Training day');
  draft = updateMeal(draft, 0, 0, { name: 'Egg white omelette', proteinG: 45 });

  const next = importDraftToPreview(draft, original);

  assert.equal(next.workout?.days[0]?.label, 'Chest Day');
  assert.equal(next.nutrition?.goals?.calories, 2400);
  assert.equal(next.nutrition?.days[0]?.label, 'Training day');
  assert.equal(next.nutrition?.days[0]?.meals[0]?.name, 'Egg white omelette');
  assert.equal(next.nutrition?.days[0]?.meals[0]?.proteinG, 45);

  // Parser output the user never saw is preserved so the server still gets the document it read.
  assert.deepEqual(next.warnings, original.warnings);
  assert.equal(next.pageCount, 4);
  assert.equal(next.kind, 'both');
});

test('a day turned into a rest day commits with no exercises', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  draft = setWorkoutDays(draft, toggleRestDay(draft.workout!.days, 0));

  const next = importDraftToPreview(draft, original);
  assert.equal(next.workout?.days[0]?.isRest, true);
  assert.deepEqual(next.workout?.days[0]?.exercises, []);
});

test('blank meals added but never filled in are dropped on commit', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  draft = addMeal(draft, 0);
  assert.equal(draft.nutrition?.days[0]?.meals.length, 3);

  const next = importDraftToPreview(draft, original);
  assert.equal(next.nutrition?.days[0]?.meals.length, 2);
});

test('a removed meal does not come back', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  draft = removeMeal(draft, 0, 0);

  const next = importDraftToPreview(draft, original);
  assert.equal(next.nutrition?.days[0]?.meals.length, 1);
  assert.equal(next.nutrition?.days[0]?.meals[0]?.name, 'Chicken and rice');
});

test('goals cleared to zero are dropped rather than committed as a zero target', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  draft = setNutritionGoal(draft, 'proteinG', 0);

  const next = importDraftToPreview(draft, original);
  assert.equal(next.nutrition?.goals?.proteinG, undefined);
  assert.equal(next.nutrition?.goals?.calories, 2200);
});

test('a draft with no training day is held back rather than committed empty', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  assert.equal(importDraftIssue(draft, 'both'), undefined);

  let days = draft.workout!.days;
  days = toggleRestDay(days, 0);
  days = toggleRestDay(days, 1);
  draft = setWorkoutDays(draft, days);
  assert.match(importDraftIssue(draft, 'both') ?? '', /workout day/i);
});

test('an unnamed day names the day that needs one', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  draft = setWorkoutDays(draft, setDayLabel(draft.workout!.days, 1, '   '));
  assert.equal(importDraftIssue(draft, 'both'), 'Give day 2 a name.');
});

test('a nutrition-only import is not asked for a training day', () => {
  const original = preview();
  const draft = { ...previewToImportDraft(original), workout: null };
  assert.equal(importDraftIssue(draft, 'nutrition'), undefined);
});

test('the summary is recomputed from the draft, not from the parse', () => {
  const original = preview();
  let draft = previewToImportDraft(original);
  assert.match(describeImportDraft(draft), /3-day cycle · 2 training · 1 rest · 2 exercises/);

  draft = setWorkoutDays(draft, toggleRestDay(draft.workout!.days, 1));
  assert.match(describeImportDraft(draft), /1 training · 2 rest/);
});

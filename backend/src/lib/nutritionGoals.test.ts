import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveMacroSplit,
  nutritionGoalsNeedUpdate,
  persistNutritionGoals,
  resolvePlanMacroTargets,
} from './nutritionGoals.js';

/** Records the calls a Supabase query chain receives so the write order can be asserted. */
function fakeGoalsDb() {
  const calls: Array<{ op: string; payload: unknown }> = [];
  const chain = (op: string, payload: unknown) => {
    calls.push({ op, payload });
    const self: any = {
      eq: () => self,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    };
    return self;
  };
  return {
    calls,
    db: {
      from: (table: string) => ({
        update: (payload: unknown) => chain(`${table}.update`, payload),
        insert: (payload: unknown) => chain(`${table}.insert`, payload),
      }),
    },
  };
}

test('a user with no saved goal still gets one from the plan defaults', () => {
  // The reported gap: generating a plan produced meals sized for 180g with nothing recording it.
  const targets = resolvePlanMacroTargets({
    macroTargets: null,
    existing: null,
    fallback: { calories: 2400, proteinG: 180 },
  });
  assert.equal(targets.proteinG, 180);
  assert.equal(targets.calories, 2400);
  assert.ok(targets.carbsG > 0);
  assert.ok(targets.fatG > 0);
});

test('coach macros outrank a stale saved goal', () => {
  const targets = resolvePlanMacroTargets({
    macroTargets: { calories: 2800, proteinG: 200, carbsG: 280, fatG: 78 },
    existing: { daily_calories: 2400, protein_g: 180 },
    fallback: { calories: 2400, proteinG: 180 },
  });
  assert.equal(targets.proteinG, 200);
  assert.equal(targets.calories, 2800);
  assert.equal(targets.carbsG, 280);
});

test('a saved goal is used when the coach has nothing to say', () => {
  const targets = resolvePlanMacroTargets({
    macroTargets: null,
    existing: { daily_calories: 2600, protein_g: 190, carbs_g: 260, fat_g: 72 },
    fallback: { calories: 2400, proteinG: 180 },
  });
  assert.equal(targets.proteinG, 190);
  assert.equal(targets.calories, 2600);
  assert.equal(targets.carbsG, 260);
  assert.equal(targets.fatG, 72);
});

test('a partial saved goal does not produce a half-empty target', () => {
  // protein_g set but daily_calories missing must not yield NaN or zero calories.
  const targets = resolvePlanMacroTargets({
    macroTargets: null,
    existing: { daily_calories: null, protein_g: 190 },
    fallback: { calories: 2400, proteinG: 180 },
  });
  assert.equal(targets.calories, 2400);
  assert.ok(Number.isFinite(targets.proteinG));
});

test('missing carbohydrate and fat are derived rather than left blank', () => {
  const targets = resolvePlanMacroTargets({
    macroTargets: { calories: 2400, proteinG: 180 },
    existing: null,
    fallback: { calories: 2000, proteinG: 150 },
  });
  assert.deepEqual(
    { carbsG: targets.carbsG, fatG: targets.fatG },
    { carbsG: deriveMacroSplit(2400, 180).carbsG, fatG: deriveMacroSplit(2400, 180).fatG },
  );
});

test('every resolved target is a whole number', () => {
  const targets = resolvePlanMacroTargets({
    macroTargets: { calories: 2433.7, proteinG: 181.4 },
    existing: null,
    fallback: { calories: 2400, proteinG: 180 },
  });
  for (const value of Object.values(targets)) {
    assert.equal(Number.isInteger(value), true, `expected integer, got ${value}`);
  }
});

test('a missing goal always needs writing', () => {
  assert.equal(nutritionGoalsNeedUpdate(null, deriveMacroSplit(2400, 180)), true);
  assert.equal(
    nutritionGoalsNeedUpdate({ daily_calories: null, protein_g: null }, deriveMacroSplit(2400, 180)),
    true,
  );
});

test('an identical goal is left alone so generation does not churn history', () => {
  assert.equal(
    nutritionGoalsNeedUpdate({ daily_calories: 2400, protein_g: 180 }, deriveMacroSplit(2400, 180)),
    false,
  );
});

test('a changed protein or calorie target is rewritten', () => {
  assert.equal(
    nutritionGoalsNeedUpdate({ daily_calories: 2400, protein_g: 170 }, deriveMacroSplit(2400, 180)),
    true,
  );
  assert.equal(
    nutritionGoalsNeedUpdate({ daily_calories: 2200, protein_g: 180 }, deriveMacroSplit(2400, 180)),
    true,
  );
});

test('the derived split is consistent with the calorie total', () => {
  const split = deriveMacroSplit(2400, 180);
  const fromMacros = split.proteinG * 4 + split.carbsG * 4 + split.fatG * 9;
  // Protein is prescribed independently, so the split need not sum exactly — but it must be in the
  // same ballpark rather than describing a different diet.
  assert.ok(Math.abs(fromMacros - 2400) < 700, `macro split implies ${fromMacros} kcal`);
});

test('saving new targets closes the old goal row before opening the new one', async () => {
  // `nutrition_goals` is an effective-dated history, so leaving the previous row active would let
  // the Nutrition tab keep reading the superseded target.
  const { calls, db } = fakeGoalsDb();

  await persistNutritionGoals(db, 'user-1', deriveMacroSplit(2100, 165), '2026-08-03');

  assert.deepEqual(calls.map((call) => call.op), ['nutrition_goals.update', 'nutrition_goals.insert']);
  assert.deepEqual(calls[0]!.payload, { is_active: false });

  const inserted = calls[1]!.payload as Record<string, unknown>;
  assert.equal(inserted.user_id, 'user-1');
  assert.equal(inserted.daily_calories, 2100);
  assert.equal(inserted.protein_g, 165);
  assert.equal(inserted.is_active, true);
  assert.equal(inserted.effective_from, '2026-08-03');
});

test('a goal change is only written when the numbers actually move', () => {
  // Switching from muscle gain to fat loss changes calories, so this must report a change.
  const current = { daily_calories: 2800, protein_g: 180 };
  assert.equal(nutritionGoalsNeedUpdate(current, deriveMacroSplit(2200, 190)), true);
  assert.equal(nutritionGoalsNeedUpdate(current, deriveMacroSplit(2800, 180)), false);
});

/**
 * Reported from a real import: "Follow this plan" succeeded and loaded no meals. The meal read runs
 * beside the day reads, and when it did not land the import quietly kept only the daily targets and
 * said nothing about it.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nutritionSection, parseProgramDocument, type AiDocumentRead } from './pdfProgramParse.js';

const PLAN = [
  '30 Day Plan',
  ...[1, 2, 3, 4, 5].flatMap((day) => [`Day ${day} — Push`, 'Bench Press 4x8', 'Overhead Press 3x10']),
  'NUTRITION | EARLY TRAINING',
  'Start around 2,300 calories daily. Protein 170 g.',
  'Breakfast 2 eggs + oats + yogurt + berries.',
  'Lunch Chicken burrito bowl with rice, beans and salsa.',
  'Dinner Fish with potatoes and vegetables.',
  'Snack cottage cheese and berries so that the section is long enough to be worth cutting out of the document.',
].join('\n');

function reader(nutrition: 'fails' | 'lands') {
  return async (prompt: { system: string; user: string }): Promise<AiDocumentRead> => {
    if (/ONLY the nutrition plan/.test(prompt.system)) {
      if (nutrition === 'fails') return { ok: false, reason: 'timeout' };
      return {
        ok: true,
        data: {
          nutrition: {
            name: 'Plan',
            days: [{ dayIndex: 0, meals: [{ mealType: 'breakfast', name: 'Eggs and oats' }] }],
          },
        } as never,
      };
    }
    return {
      ok: true,
      data: {
        day: { label: 'Push', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] },
      } as never,
    };
  };
}

describe('the meal read in a combined import', () => {
  it('says so when the meals did not come back, instead of loading targets alone in silence', async () => {
    const preview = await parseProgramDocument({ text: PLAN, kind: 'both', readWithAi: reader('fails') });

    assert.equal(preview.nutrition?.days.length ?? 0, 0);
    assert.ok(preview.warnings.some((w) => /meal plan could not be read/i.test(w)));
  });

  it('stays quiet when the meals did come back', async () => {
    const preview = await parseProgramDocument({ text: PLAN, kind: 'both', readWithAi: reader('lands') });

    assert.equal(preview.nutrition?.days.length, 1);
    assert.ok(!preview.warnings.some((w) => /meal plan could not be read/i.test(w)));
  });
});

describe('finding the food in a combined document', () => {
  it('hands the meal read only the nutrition section', () => {
    const section = nutritionSection(PLAN);
    assert.match(section, /^NUTRITION/);
    assert.ok(!section.includes('Bench Press'));
  });

  it('uses the whole document when there is no nutrition heading', () => {
    const text = 'Day 1\nBench Press 4x8\n'.repeat(20);
    assert.equal(nutritionSection(text), text);
  });
});

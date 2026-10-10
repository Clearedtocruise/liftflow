/**
 * Reading a long plan one day at a time.
 *
 * Reported from a real import: a ten-day plan with forty-four exercises came back "The AI read of
 * this plan took too long", with Day 1 showing as Rest and 300 kcal/day. Writing out the whole
 * cycle as one blob of JSON is most of what the import spends, and a plan that size does not
 * finish inside any budget the phone will wait for. Splitting it turns one long generation into
 * short ones that run together.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseProgramDocument,
  splitDocumentIntoDaySections,
  type AiDocumentRead,
} from './pdfProgramParse.js';

function planWithDays(count: number): string {
  const lines = ['12 Week Hypertrophy Block', 'Run every set to two reps in reserve.'];
  for (let day = 1; day <= count; day += 1) {
    lines.push(`Day ${day} — Push`, `Bench Press 4x8`, `Overhead Press 3x10`, `Tricep Pushdown 3x12`);
  }
  return lines.join('\n');
}

const TEN_DAY_PLAN = planWithDays(10);

/** Answers each day with a single exercise named after the day text it was given. */
function perDayReader() {
  const prompts: string[] = [];
  const read = async (prompt: { system: string; user: string }): Promise<AiDocumentRead> => {
    prompts.push(prompt.user);
    const dayNumber = prompt.user.match(/Day (\d+)/)?.[1] ?? '?';
    return {
      ok: true,
      data: {
        day: {
          label: `Day ${dayNumber} — Push`,
          isRest: false,
          exercises: [
            { name: 'Bench Press', sets: 4, reps: '8' },
            { name: 'Overhead Press', sets: 3, reps: '10' },
            { name: 'Tricep Pushdown', sets: 3, reps: '12' },
          ],
        },
      } as never,
    };
  };
  return { read, prompts };
}

describe('splitting a document into days', () => {
  it('cuts one section per day header', () => {
    const { days } = splitDocumentIntoDaySections(TEN_DAY_PLAN);
    assert.equal(days.length, 10);
    assert.match(days[0].label, /Day 1/);
    assert.match(days[9].label, /Day 10/);
  });

  it('keeps each day with its own exercises', () => {
    const { days } = splitDocumentIntoDaySections(TEN_DAY_PLAN);
    assert.match(days[3].text, /Day 4/);
    assert.match(days[3].text, /Bench Press 4x8/);
    assert.ok(!days[3].text.includes('Day 5'), 'a day swallowed the one after it');
  });

  it('holds back what was said before the first day', () => {
    const { preamble } = splitDocumentIntoDaySections(TEN_DAY_PLAN);
    assert.match(preamble, /two reps in reserve/);
    assert.ok(!preamble.includes('Bench Press'), 'exercises leaked into the preamble');
  });

  it('finds nothing to split in a document with no day headers', () => {
    const { days } = splitDocumentIntoDaySections('Bench Press 4x8\nSquat 5x5');
    assert.equal(days.length, 0);
  });
});

describe('a long plan', () => {
  it('is asked for one day at a time rather than all at once', async () => {
    const { read, prompts } = perDayReader();
    await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.equal(prompts.length, 10, 'the whole cycle was still asked for in one generation');
    assert.ok(
      prompts.every((prompt) => (prompt.match(/Day \d+ — Push/g) ?? []).length === 1),
      'a request carried more than its own day',
    );
  });

  it('comes back with every day the document holds', async () => {
    const { read } = perDayReader();
    const preview = await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.equal(preview.workout?.days.length, 10);
    assert.equal(preview.workout?.days.filter((day) => !day.isRest).length, 10);
    assert.equal(preview.workout?.days[0].exercises.length, 3);
  });

  it('carries the plan-wide note into each day so a protocol stated once is not lost', async () => {
    const { read, prompts } = perDayReader();
    await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.ok(
      prompts.every((prompt) => /two reps in reserve/.test(prompt)),
      'the plan-wide instruction was dropped by the split',
    );
  });

  it('does not claim it was parsed without AI', async () => {
    const { read } = perDayReader();
    const preview = await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.ok(!preview.warnings.some((warning) => /^parsed without ai/i.test(warning)));
    assert.ok(!preview.warnings.some((warning) => /took too long/i.test(warning)));
  });
});

describe('when some days do not come back', () => {
  it('keeps the unread day in its own slot instead of shifting the cycle up', async () => {
    let call = 0;
    const read = async (): Promise<AiDocumentRead> => {
      call += 1;
      // The third request is the one that fails.
      if (call === 3) return { ok: false, reason: 'timeout' };
      return {
        ok: true,
        data: { day: { label: 'Read day', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] } } as never,
      };
    };

    const preview = await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.equal(preview.workout?.days.length, 10, 'the cycle lost a day');
    assert.ok(preview.warnings.some((w) => /1 of 10 days could not be read/i.test(w)));
  });

  it('falls back to the document structure when no day comes back at all', async () => {
    const read = async (): Promise<AiDocumentRead> => ({ ok: false, reason: 'timeout' });
    const preview = await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });

    assert.equal(preview.workout?.days.length, 10, 'the structure the document gave was thrown away too');
    assert.ok(preview.warnings.some((warning) => /took too long/i.test(warning)));
  });
});

describe('a short plan', () => {
  it('is still read in one go, where splitting would only cost requests', async () => {
    const prompts: string[] = [];
    const read = async (prompt: { system: string; user: string }): Promise<AiDocumentRead> => {
      prompts.push(prompt.user);
      return {
        ok: true,
        data: {
          workout: {
            name: 'Imported',
            lengthDays: 3,
            days: [1, 2, 3].map((n) => ({
              label: `Day ${n}`,
              isRest: false,
              exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }],
            })),
          },
        },
      };
    };

    await parseProgramDocument({ text: planWithDays(3), kind: 'workout', readWithAi: read });
    assert.equal(prompts.length, 1);
  });
});

describe('a long plan that also carries a meal plan', () => {
  it('still asks the AI about the food, which the day split would otherwise skip', async () => {
    const systems: string[] = [];
    const read = async (prompt: { system: string; user: string }): Promise<AiDocumentRead> => {
      systems.push(prompt.system);
      if (/ONLY the nutrition/.test(prompt.system)) {
        return {
          ok: true,
          data: {
            nutrition: {
              name: 'Cut',
              goals: { calories: 2400, proteinG: 200 },
              days: [{ dayIndex: 0, label: 'Monday', meals: [{ mealType: 'breakfast', name: 'Oats', calories: 400 }] }],
            },
          } as never,
        };
      }
      return {
        ok: true,
        data: { day: { label: 'Day', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] } } as never,
      };
    };

    const preview = await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'both', readWithAi: read });

    assert.equal(systems.filter((s) => /ONLY the nutrition/.test(s)).length, 1, 'the meal plan was never asked for');
    assert.equal(preview.nutrition?.goals?.calories, 2400);
    assert.equal(preview.nutrition?.days[0].meals.length, 1);
    assert.equal(preview.workout?.days.length, 10, 'the workout half was lost');
  });

  it('does not ask about food when only the workout was requested', async () => {
    const { read, prompts } = perDayReader();
    await parseProgramDocument({ text: TEN_DAY_PLAN, kind: 'workout', readWithAi: read });
    assert.equal(prompts.length, 10, 'a nutrition request was made for a workout-only import');
  });
});

describe('a very long plan', () => {
  it('does not put every day in flight at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const read = async (): Promise<AiDocumentRead> => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return {
        ok: true,
        data: { day: { label: 'Day', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] } } as never,
      };
    };

    const preview = await parseProgramDocument({ text: planWithDays(30), kind: 'workout', readWithAi: read });

    assert.ok(peak <= 6, `${peak} reads were in flight at once`);
    assert.equal(preview.workout?.days.length, 30, 'days were lost by the batching');
  });

  it('keeps the days in the order the document gave them', async () => {
    const read = async (prompt: { system: string; user: string }): Promise<AiDocumentRead> => {
      const dayNumber = prompt.user.match(/Day (\d+)/)?.[1] ?? '?';
      // Later days answer faster, so order can only survive if it is not resolution order.
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 10 - Number(dayNumber))));
      return {
        ok: true,
        data: {
          day: { label: `Day ${dayNumber}`, isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] },
        } as never,
      };
    };

    const preview = await parseProgramDocument({ text: planWithDays(8), kind: 'workout', readWithAi: read });
    assert.deepEqual(
      preview.workout?.days.map((day) => day.label),
      ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8'],
    );
  });
});

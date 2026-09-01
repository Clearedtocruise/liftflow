import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AGGRESSIVE_CUT_WORKOUT_DAYS } from './aggressiveCutWorkouts.js';

/**
 * These mirror the name normalization used by the session seeding trigger
 * (`seed_session_exercises_from_plan`) and the client resolver. A planned exercise name that
 * produces a blank key/slug can never be matched or created, so the trigger skips it — which is
 * exactly how a day started on its second lift (Pull-Up dropped, Barbell Row first).
 */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

test('every aggressive cut planned exercise name is resolvable-shaped (no session holes)', () => {
  for (const day of AGGRESSIVE_CUT_WORKOUT_DAYS) {
    assert.ok(day.exercises.length > 0, `${day.label} has no exercises`);
    day.exercises.forEach((exercise, index) => {
      const raw = exercise.name ?? '';
      const trimmed = raw.trim();
      assert.ok(trimmed.length > 0, `${day.label}[${index}] has a blank exercise name`);
      // Must contain letters so it is not a stray number that resolves to nothing.
      assert.ok(/[a-z]/i.test(trimmed), `${day.label}[${index}] "${raw}" has no letters`);
      assert.ok(nameKey(trimmed).length > 0, `${day.label}[${index}] "${raw}" yields an empty key`);
      assert.ok(slugFromName(trimmed).length > 0, `${day.label}[${index}] "${raw}" yields an empty slug`);
    });
  }
});

test('the reported skip day keeps Pull-Up as its first exercise', () => {
  const backDay = AGGRESSIVE_CUT_WORKOUT_DAYS.find((day) => day.label === 'Back + Rear Delts');
  assert.ok(backDay, 'Back + Rear Delts day missing');
  assert.equal(backDay!.exercises[0]?.name, 'Pull-Up');
  // Barbell Row must not be first — that was the visible symptom of the drop bug.
  assert.notEqual(backDay!.exercises[0]?.name, 'Barbell Row');
});

test('no planned day has two exercises that collapse to the same slug in sequence', () => {
  // Adjacent identical slugs would let one row satisfy both plan slots and shorten the session.
  for (const day of AGGRESSIVE_CUT_WORKOUT_DAYS) {
    for (let i = 1; i < day.exercises.length; i += 1) {
      const prev = slugFromName(day.exercises[i - 1].name);
      const curr = slugFromName(day.exercises[i].name);
      assert.notEqual(curr, prev, `${day.label} repeats slug ${curr} back-to-back`);
    }
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASELINE_LIFTS,
  collectBaselines,
  estimateOneRepMaxLbs,
  isPlausibleBaseline,
} from '@/constants/strengthBaseline';

test('the estimate matches the backend formula', () => {
  // Both sides use Epley, so a reported set and a logged set are measured the same way.
  assert.equal(estimateOneRepMaxLbs(185, 5), 216);
  assert.equal(estimateOneRepMaxLbs(225, 1), 225);
  assert.equal(estimateOneRepMaxLbs(0, 5), 0);
});

test('a long set does not imply an enormous max', () => {
  assert.equal(estimateOneRepMaxLbs(135, 30), estimateOneRepMaxLbs(135, 12));
});

test('only complete, plausible rows are saved', () => {
  const saved = collectBaselines({
    squat: { weight: '275', reps: '5' },
    bench_press: { weight: '185', reps: '' },
    deadlift: { weight: '', reps: '' },
    overhead_press: { weight: '99999', reps: '5' },
  });

  // A half-filled row is not a baseline, and a typo must never become a training load.
  assert.deepEqual(Object.keys(saved), ['squat']);
  assert.deepEqual(saved.squat, { weightLbs: 275, reps: 5 });
});

test('an empty form saves nothing rather than zeroes', () => {
  assert.deepEqual(collectBaselines({}), {});
});

test('implausible entries are rejected', () => {
  assert.equal(isPlausibleBaseline({ weightLbs: 185, reps: 5 }), true);
  assert.equal(isPlausibleBaseline({ weightLbs: 4, reps: 5 }), false);
  assert.equal(isPlausibleBaseline({ weightLbs: 185, reps: 25 }), false);
  assert.equal(isPlausibleBaseline({ weightLbs: Number.NaN, reps: 5 }), false);
  assert.equal(isPlausibleBaseline(null), false);
});

test('every lift asked about is labelled for the athlete', () => {
  assert.equal(BASELINE_LIFTS.length, 4);
  for (const lift of BASELINE_LIFTS) {
    assert.ok(lift.label.length > 0, `${lift.id} needs a label`);
    assert.ok(lift.hint.length > 0, `${lift.id} needs a hint so it is unambiguous`);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { isIntervalCycleMode, normalizeCycle, normalizeCycleExecutionMode } from './programCycle.js';

/**
 * The cycle template is where a day's execution mode is persisted, and `materializeCycleDay` copies
 * it onto the planned workout, which is what the session reads to decide between straight sets and
 * the interval timer. If normalization drops it, an imported Tabata day runs as traditional.
 */

test('a known mode survives normalization', () => {
  const cycle = normalizeCycle({
    lengthDays: 2,
    days: [
      { label: 'Push', exercises: [{ name: 'Bench Press', sets: 4 }] },
      {
        label: 'Conditioning',
        executionMode: 'tabata',
        intervalWorkSeconds: 20,
        intervalRestSeconds: 10,
        intervalRounds: 8,
        exercises: [{ name: 'Burpees', sets: 4 }],
      },
    ],
  });

  assert.equal(cycle.days[0]?.executionMode, undefined);
  assert.equal(cycle.days[1]?.executionMode, 'tabata');
  assert.equal(cycle.days[1]?.intervalWorkSeconds, 20);
  assert.equal(cycle.days[1]?.intervalRestSeconds, 10);
  assert.equal(cycle.days[1]?.intervalRounds, 8);
});

test('an unknown mode is treated as traditional rather than stored', () => {
  assert.equal(normalizeCycleExecutionMode('crossfit'), undefined);
  assert.equal(normalizeCycleExecutionMode('traditional'), undefined);
  assert.equal(normalizeCycleExecutionMode(42), undefined);
  assert.equal(normalizeCycleExecutionMode('TABATA'), 'tabata');
});

test('interval timings are dropped from a mode that does not run on a clock', () => {
  const cycle = normalizeCycle({
    lengthDays: 1,
    days: [{ label: 'Circuit', executionMode: 'circuit', intervalWorkSeconds: 30, exercises: [{ name: 'Row', sets: 3 }] }],
  });
  assert.equal(cycle.days[0]?.executionMode, 'circuit');
  assert.equal(cycle.days[0]?.intervalWorkSeconds, undefined);
});

test('a rest day carries no mode', () => {
  const cycle = normalizeCycle({
    lengthDays: 1,
    days: [{ label: 'Rest', isRest: true, executionMode: 'tabata' }],
  });
  assert.equal(cycle.days[0]?.executionMode, undefined);
});

test('a nonsense timing is dropped rather than prescribed', () => {
  const cycle = normalizeCycle({
    lengthDays: 1,
    days: [
      {
        label: 'Conditioning',
        executionMode: 'tabata',
        intervalWorkSeconds: -20,
        intervalRestSeconds: Number.NaN,
        intervalRounds: 8,
        exercises: [{ name: 'Burpees', sets: 4 }],
      },
    ],
  });
  assert.equal(cycle.days[0]?.intervalWorkSeconds, undefined);
  assert.equal(cycle.days[0]?.intervalRestSeconds, undefined);
  assert.equal(cycle.days[0]?.intervalRounds, 8);
});

test('a per-exercise mode and superset pairing survive normalization', () => {
  const cycle = normalizeCycle({
    lengthDays: 1,
    days: [
      {
        label: 'Push',
        exercises: [{ name: 'Bench Press', sets: 4, restSeconds: 180, executionMode: 'strength', supersetGroupId: 'a' }],
      },
    ],
  });
  const exercise = cycle.days[0]?.exercises[0];
  assert.equal(exercise?.restSeconds, 180);
  assert.equal(exercise?.executionMode, 'strength');
  assert.equal(exercise?.supersetGroupId, 'a');
});

test('interval modes are the ones that run on a clock', () => {
  assert.equal(isIntervalCycleMode('tabata'), true);
  assert.equal(isIntervalCycleMode('hiit'), true);
  assert.equal(isIntervalCycleMode('circuit'), false);
  assert.equal(isIntervalCycleMode(undefined), false);
});

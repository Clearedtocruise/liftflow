import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultTimedDurationSeconds } from './exerciseModality';
import { resolveExerciseInputSeed } from './activeWorkoutWeightSeed';

/**
 * A plank that will not come off 30 seconds.
 *
 * Two things pinned it there: a prescription written without a "sec" suffix fell through to the
 * 30 second fallback, and the duration field was re-seeded from the plan on every session refresh.
 * These cover the parsing half; the re-seed half is pinned by validate:timed-hold-logging.
 */

test('a prescription in seconds is read as written', () => {
  assert.equal(defaultTimedDurationSeconds('60 sec'), 60);
  assert.equal(defaultTimedDurationSeconds('60s'), 60);
  assert.equal(defaultTimedDurationSeconds('45 seconds'), 45);
  assert.equal(defaultTimedDurationSeconds('90 SEC'), 90);
});

test('a prescription written as a bare number is a duration, not a rep count', () => {
  // Only ever consulted for an exercise already known to be timed, so "60" on a plank means a
  // minute. This used to seed the field at 30 and need correcting on every single set.
  assert.equal(defaultTimedDurationSeconds('60'), 60);
  assert.equal(defaultTimedDurationSeconds('45'), 45);
});

test('a range works up to its top end', () => {
  assert.equal(defaultTimedDurationSeconds('30-60 sec'), 60);
  assert.equal(defaultTimedDurationSeconds('45-75 sec'), 75);
  assert.equal(defaultTimedDurationSeconds('30-45 sec/side'), 45);
  assert.equal(defaultTimedDurationSeconds('30-60'), 60);
});

test('minutes are converted rather than read as seconds', () => {
  assert.equal(defaultTimedDurationSeconds('2 min'), 120);
  assert.equal(defaultTimedDurationSeconds('1 minute'), 60);
  assert.equal(defaultTimedDurationSeconds('1 min'), 60);
});

test('a clock time is not read as its first number', () => {
  assert.equal(defaultTimedDurationSeconds('1:30'), 90);
  assert.equal(defaultTimedDurationSeconds('2:00'), 120);
});

test('nothing usable falls back to thirty seconds', () => {
  assert.equal(defaultTimedDurationSeconds(''), 30);
  assert.equal(defaultTimedDurationSeconds(null), 30);
  assert.equal(defaultTimedDurationSeconds(undefined), 30);
  assert.equal(defaultTimedDurationSeconds('to failure'), 30);
  assert.equal(defaultTimedDurationSeconds('0 sec'), 30);
});

test('the next set opens on the hold just completed, not back at the plan', () => {
  const seed = resolveExerciseInputSeed({
    sessionSets: [{ durationSeconds: 60, reps: 1 }],
    planRepRange: '30 sec',
  });
  assert.equal(seed.durationSeconds, 60);
});

test('the first set of the day opens on this movement\u2019s last session', () => {
  const seed = resolveExerciseInputSeed({
    sessionSets: [],
    historyDurationSeconds: 75,
    planRepRange: '30 sec',
  });
  assert.equal(seed.durationSeconds, 75);
});

test('with no history at all the plan decides', () => {
  assert.equal(
    resolveExerciseInputSeed({ sessionSets: [], planRepRange: '60 sec' }).durationSeconds,
    60,
  );
  assert.equal(
    resolveExerciseInputSeed({ sessionSets: [], planRepRange: '30-60 sec' }).durationSeconds,
    60,
  );
});

test('this session outranks a shorter hold from a previous one', () => {
  const seed = resolveExerciseInputSeed({
    sessionSets: [{ durationSeconds: 60, reps: 1 }],
    historyDurationSeconds: 30,
    planRepRange: '30 sec',
  });
  assert.equal(seed.durationSeconds, 60);
});

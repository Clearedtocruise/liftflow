import assert from 'node:assert/strict';
import test from 'node:test';

import { computeWorkoutStreak } from './workoutStreak';

const LA = 'America/Los_Angeles';

test('no sessions is no streak', () => {
  assert.equal(computeWorkoutStreak([], { timeZone: LA, today: '2026-10-06' }), 0);
});

test('consecutive days count up', () => {
  const streak = computeWorkoutStreak(
    [
      '2026-10-06T18:00:00.000Z',
      '2026-10-05T18:00:00.000Z',
      '2026-10-04T18:00:00.000Z',
    ],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 3);
});

test('an afternoon session is counted on the day it was trained, not the next UTC day', () => {
  // 5:19pm in Los Angeles on Oct 6 is already Oct 7 in UTC. Bucketing by the UTC day dropped the
  // session out of Oct 6 and broke the streak at the day before it.
  const streak = computeWorkoutStreak(
    [
      '2026-10-07T00:19:00.000Z', // Tue Oct 6, 5:19pm PDT
      '2026-10-06T00:30:00.000Z', // Mon Oct 5, 5:30pm PDT
      '2026-10-05T01:00:00.000Z', // Sun Oct 4, 6:00pm PDT
    ],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 3);
});

test('morning and evening sessions on the same local day count once', () => {
  const streak = computeWorkoutStreak(
    [
      '2026-10-07T00:19:00.000Z', // Tue Oct 6, 5:19pm PDT
      '2026-10-06T15:00:00.000Z', // Tue Oct 6, 8:00am PDT
    ],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 1);
});

test('not having trained yet today keeps yesterdays streak alive', () => {
  const streak = computeWorkoutStreak(
    ['2026-10-06T16:00:00.000Z', '2026-10-05T16:00:00.000Z'],
    { timeZone: LA, today: '2026-10-07' },
  );
  assert.equal(streak, 2);
});

test('a gap of two days ends the streak', () => {
  const streak = computeWorkoutStreak(
    ['2026-10-04T16:00:00.000Z', '2026-10-03T16:00:00.000Z'],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 0);
});

test('only the run ending today is counted, not an older longer one', () => {
  const streak = computeWorkoutStreak(
    [
      '2026-10-06T16:00:00.000Z',
      '2026-10-02T16:00:00.000Z',
      '2026-10-01T16:00:00.000Z',
      '2026-09-30T16:00:00.000Z',
    ],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 1);
});

test('the streak counts across a month boundary', () => {
  const streak = computeWorkoutStreak(
    [
      '2026-10-01T16:00:00.000Z',
      '2026-09-30T16:00:00.000Z',
      '2026-09-29T16:00:00.000Z',
    ],
    { timeZone: LA, today: '2026-10-01' },
  );
  assert.equal(streak, 3);
});

test('unparseable timestamps are ignored rather than counted', () => {
  const streak = computeWorkoutStreak(
    ['not-a-date', null, undefined, '2026-10-06T16:00:00.000Z'],
    { timeZone: LA, today: '2026-10-06' },
  );
  assert.equal(streak, 1);
});

test('the day either side of a DST change still counts', () => {
  // US clocks go back on Nov 1 2026.
  const streak = computeWorkoutStreak(
    [
      '2026-11-02T17:00:00.000Z', // Mon Nov 2, 9:00am PST
      '2026-11-01T17:00:00.000Z', // Sun Nov 1, 9:00am PST
      '2026-10-31T16:00:00.000Z', // Sat Oct 31, 9:00am PDT
    ],
    { timeZone: LA, today: '2026-11-02' },
  );
  assert.equal(streak, 3);
});

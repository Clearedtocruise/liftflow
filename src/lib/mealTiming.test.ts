import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canShiftLater,
  clampEatenAt,
  defaultEatenAt,
  EATEN_STEP_MINUTES,
  formatClockTime,
  MAX_BACKDATE_HOURS,
  mealTimeLabel,
  shiftEatenAt,
} from './mealTiming';

const now = new Date('2026-07-31T12:00:00');

test('an eaten time can be nudged back in steps', () => {
  const start = now.toISOString();
  const earlier = shiftEatenAt(start, -EATEN_STEP_MINUTES, now);
  assert.equal(new Date(earlier).getTime(), now.getTime() - 15 * 60 * 1000);
});

test('an eaten time never lands in the future', () => {
  const start = now.toISOString();
  assert.equal(shiftEatenAt(start, 60, now), now.toISOString());
  assert.equal(clampEatenAt(new Date(now.getTime() + 5 * 60 * 60 * 1000), now).getTime(), now.getTime());
});

test('the later control is disabled once the time reaches now', () => {
  assert.equal(canShiftLater(now.toISOString(), EATEN_STEP_MINUTES, now), false);
  const earlier = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  assert.equal(canShiftLater(earlier, EATEN_STEP_MINUTES, now), true);
});

test('back-dating stops at the supported window', () => {
  const ancient = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const clamped = clampEatenAt(ancient, now);
  assert.equal(clamped.getTime(), now.getTime() - MAX_BACKDATE_HOURS * 60 * 60 * 1000);
});

test("today's meal defaults to right now", () => {
  assert.equal(defaultEatenAt('2026-07-31', now), now.toISOString());
});

test("yesterday's meal is not stamped with today's clock", () => {
  const eaten = new Date(defaultEatenAt('2026-07-30', now));
  assert.equal(eaten.getDate(), 30);
  assert.ok(eaten.getTime() < now.getTime());
});

test('a logged meal shows when it was eaten, not when it was planned', () => {
  const consumedAt = new Date('2026-07-31T07:42:00').toISOString();
  const label = mealTimeLabel({ consumedAt, scheduledTime: '7:15 AM', eaten: true }, now);
  assert.ok(label.startsWith('Ate '));
  assert.ok(!label.includes('7:15'));

  assert.equal(
    mealTimeLabel({ scheduledTime: '7:15 AM', eaten: false }, now),
    '7:15 AM',
  );
});

test('an eaten meal with no timestamp still reads as eaten', () => {
  assert.equal(mealTimeLabel({ eaten: true }, now), 'Eaten');
});

test('times from another day carry the date', () => {
  const yesterday = new Date('2026-07-30T19:00:00').toISOString();
  const label = formatClockTime(yesterday, now);
  assert.ok(label && /Jul/.test(label), `expected a dated label, got ${label}`);
});

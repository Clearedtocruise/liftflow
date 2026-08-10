import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cutPlanWeekWindow } from './cutPlanWeek.js';

test('cut plan week follows the athlete timezone, not UTC', () => {
  // Monday 04:10 UTC is still Sunday evening in US Pacific / Central.
  const instant = new Date('2026-08-10T04:10:00.000Z');

  const utc = cutPlanWeekWindow(instant, 'UTC');
  assert.equal(utc.today, '2026-08-10');
  assert.equal(utc.weekStart, '2026-08-10');

  const pacific = cutPlanWeekWindow(instant, 'America/Los_Angeles');
  assert.equal(pacific.today, '2026-08-09');
  assert.equal(pacific.weekStart, '2026-08-03');
  assert.equal(pacific.weekEnd, '2026-08-09');

  const central = cutPlanWeekWindow(instant, 'America/Chicago');
  assert.equal(central.today, '2026-08-09');
  assert.equal(central.weekStart, '2026-08-03');
});

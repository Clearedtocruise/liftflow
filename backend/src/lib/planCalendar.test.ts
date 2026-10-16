import assert from 'node:assert/strict';
import test from 'node:test';

import { detectPlanStartDay } from './planCalendar.js';

const TABLE = `
Your 30-day calendar
Session Week 1 Week 2 Week 3 Week 4 Finish
A: Chest/triceps Oct 10 Oct 17 Oct 24 Oct 31 Nov 7
B: Back/biceps Oct 11 Oct 18 Oct 25 Nov 1 Nov 8
C: Legs/core - squat Oct 12 Oct 19 Oct 26 Nov 2 -
D: Chest/shoulders/triceps Oct 13 Oct 20 Oct 27 Nov 3 -
E: Back/biceps/rear delts Oct 14 Oct 21 Oct 28 Nov 4 -
F: Legs/core - posterior chain Oct 15 Oct 22 Oct 29 Nov 5 -
Rest / easy walk Oct 16 Oct 23 Oct 30 Nov 6 -
Workout basics
Dates: Oct 10, 17, 24, 31; Nov 7 | About 2,300 calories / 180 g protein
`;

test('the rest day is found from the plan calendar, so the next day is Day 1', () => {
  assert.deepEqual(detectPlanStartDay(TABLE, '2026-10-16', 7), { day: 7, label: 'Rest / easy walk' });
});

test('any week of the plan resolves to the same session row', () => {
  assert.equal(detectPlanStartDay(TABLE, '2026-10-10', 7)?.day, 1);
  assert.equal(detectPlanStartDay(TABLE, '2026-10-24', 7)?.day, 1);
  assert.equal(detectPlanStartDay(TABLE, '2026-11-02', 7)?.day, 3);
  assert.equal(detectPlanStartDay(TABLE, '2026-11-08', 7)?.day, 2);
});

test('a date outside the plan is unknown, not guessed', () => {
  assert.equal(detectPlanStartDay(TABLE, '2026-12-25', 7), null);
});

test('a table that does not match the days that were read is not trusted', () => {
  assert.equal(detectPlanStartDay(TABLE, '2026-10-16', 6), null);
  assert.equal(detectPlanStartDay(TABLE, '2026-10-16', 8), null);
});

test('prose with dates in it is not a calendar', () => {
  const prose = 'Week one runs Oct 10 to Oct 16 and then Oct 17 to Oct 23.\nStart on Oct 16 or Oct 17.';
  assert.equal(detectPlanStartDay(prose, '2026-10-16', 2), null);
});

test('a document with no calendar is unknown', () => {
  assert.equal(detectPlanStartDay('Day 1\nBench 4x8\nDay 2\nSquat 4x8', '2026-10-16', 2), null);
  assert.equal(detectPlanStartDay(TABLE, 'not-a-date', 7), null);
});

test('a previewed plan carries the start day its own calendar gives for today', async () => {
  const { previewProgramImport } = await import('./pdfProgramImport.js');
  const text = [
    'Calendar',
    'Push Oct 10 Oct 13 Oct 16',
    'Pull Oct 11 Oct 14 Oct 17',
    'Rest Oct 12 Oct 15 Oct 18',
    '',
    'Day 1 — Push',
    'Bench Press 4x8',
    'Overhead Press 3x10',
    'Triceps Pushdown 3x12',
    '',
    'Day 2 — Pull',
    'Barbell Row 4x8',
    'Lat Pulldown 3x10',
    'Biceps Curl 3x12',
    '',
    'Day 3 — Rest',
    'Easy walk',
  ].join('\n');

  const preview = await previewProgramImport({ type: 'text', text }, 'workout', { today: '2026-10-17' });
  assert.equal(preview.workout?.days.length, 3);
  assert.equal(preview.startDay, 2);
  assert.equal(preview.startDayLabel, 'Pull');

  const withoutToday = await previewProgramImport({ type: 'text', text }, 'workout');
  assert.equal(withoutToday.startDay, undefined);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  advanceCycleDay,
  applyCycleTemplateEdit,
  clampCycleLength,
  completeCurrentCycleDay,
  currentCycleDay,
  normalizeCurrentDay,
  normalizeCycle,
  reconcileCycleForDate,
  CYCLE_MAX_DAYS,
} from './programCycle.js';

test('cycle length clamps to 1..30', () => {
  assert.equal(clampCycleLength(0), 1);
  assert.equal(clampCycleLength(31), 30);
  assert.equal(clampCycleLength(14), 14);
});

test('1-day, 7-day and 30-day programs all roll the final day back to Day 1', () => {
  assert.equal(advanceCycleDay(1, 1), 1);
  assert.equal(advanceCycleDay(7, 7), 1);
  assert.equal(advanceCycleDay(30, 30), 1);
});

test('completing the final day loops the pointer to Day 1', () => {
  const cycle = normalizeCycle({ lengthDays: 10, currentDay: 10, days: Array.from({ length: 10 }, () => ({})) });
  assert.equal(completeCurrentCycleDay(cycle).currentDay, 1);
});

test('normalizeCycle enforces exactly lengthDays days and 30-day maximum', () => {
  const cycle = normalizeCycle({ lengthDays: 45, days: Array.from({ length: 45 }, () => ({})) });
  assert.equal(cycle.lengthDays, CYCLE_MAX_DAYS);
  assert.equal(cycle.days.length, CYCLE_MAX_DAYS);
  cycle.days.forEach((day, i) => assert.equal(day.dayNumber, i + 1));
});

test('rest days drop exercises and advance normally', () => {
  const cycle = normalizeCycle({
    lengthDays: 2,
    currentDay: 1,
    days: [
      { label: 'Push', exercises: [{ name: 'Bench', sets: 3 }] },
      { label: 'Rest', isRest: true, exercises: [{ name: 'nope', sets: 3 }] },
    ],
  });
  assert.deepEqual(cycle.days[1]?.exercises, []);
  assert.equal(completeCurrentCycleDay(cycle).currentDay, 2);
});

test('editing an active program keeps the pointer and history-independence', () => {
  const cycle = normalizeCycle({ lengthDays: 4, currentDay: 3, days: Array.from({ length: 4 }, () => ({})) });
  const edited = applyCycleTemplateEdit(cycle, {
    days: [{ label: 'A', exercises: [{ name: 'Squat', sets: 5 }] }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
  });
  assert.equal(edited.currentDay, 3);
  assert.equal(edited.version, cycle.version + 1);
  assert.equal(edited.days[0]?.exercises[0]?.name, 'Squat');
});

test('reconcile auto-advances past elapsed rest days but waits on workout days', () => {
  // Day 2 is a rest day scheduled for 2026-01-01; today is 2026-01-02 → rest elapsed, land on Day 3.
  const cycle = normalizeCycle({
    lengthDays: 4,
    currentDay: 2,
    anchorDate: '2026-01-01',
    days: [{ label: 'Push' }, { label: 'Rest', isRest: true }, { label: 'Pull' }, { label: 'Legs' }],
  });
  const result = reconcileCycleForDate(cycle, '2026-01-02');
  assert.equal(result.advanced, true);
  assert.equal(result.activeDayNumber, 3);
  assert.equal(currentCycleDay(result.cycle)?.label, 'Pull');
});

test('reconcile leaves a missed workout day on today instead of skipping it', () => {
  const cycle = normalizeCycle({
    lengthDays: 3,
    currentDay: 1,
    anchorDate: '2026-01-01',
    days: [{ label: 'Push' }, { label: 'Pull' }, { label: 'Legs' }],
  });
  const result = reconcileCycleForDate(cycle, '2026-01-05');
  assert.equal(result.advanced, false);
  assert.equal(result.activeDayNumber, 1, 'a missed workout day rolls forward, it is not skipped');
  assert.equal(result.cycle.anchorDate, '2026-01-05');
});

test('reconcile is a no-op when the anchor is today or in the future', () => {
  const cycle = normalizeCycle({ lengthDays: 3, currentDay: 2, anchorDate: '2026-01-05', days: Array.from({ length: 3 }, () => ({})) });
  assert.equal(reconcileCycleForDate(cycle, '2026-01-05').advanced, false);
  assert.equal(reconcileCycleForDate(cycle, '2026-01-04').activeDayNumber, 2);
});

test('persistence: a stored pointer survives a reload round-trip', () => {
  const created = normalizeCycle({
    lengthDays: 5,
    currentDay: 1,
    days: Array.from({ length: 5 }, (_, i) => ({ label: `Day ${i + 1}` })),
  });
  const afterTwo = completeCurrentCycleDay(completeCurrentCycleDay(created));
  assert.equal(afterTwo.currentDay, 3);
  // Simulate save→JSON→reload (what training_programs.metadata does).
  const reloaded = normalizeCycle(JSON.parse(JSON.stringify(afterTwo)));
  assert.equal(reloaded.currentDay, 3, 'the day pointer must survive a restart / re-login');
  assert.equal(reloaded.lengthDays, 5);
});

test('normalizeCurrentDay wraps under- and over-flow', () => {
  assert.equal(normalizeCurrentDay(0, 5), 5);
  assert.equal(normalizeCurrentDay(6, 5), 1);
  assert.equal(normalizeCurrentDay(11, 5), 1);
});

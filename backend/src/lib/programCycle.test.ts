import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  advanceCycleDay,
  applyCycleTemplateEdit,
  clampCycleLength,
  completeCurrentCycleDay,
  currentCycleDay,
  cycleWorkoutName,
  needsCycleDayMaterialization,
  normalizeCurrentDay,
  normalizeCycle,
  projectedCycleDayNumber,
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

test('projectedCycleDayNumber walks the rest of the week forward and loops', () => {
  const cycle = { currentDay: 5, lengthDays: 6 };
  assert.equal(projectedCycleDayNumber(cycle, 0), 5, 'today is the pointer itself');
  assert.equal(projectedCycleDayNumber(cycle, 1), 6);
  assert.equal(projectedCycleDayNumber(cycle, 2), 1, 'Day 6 → Day 1 loops on the day after tomorrow');
  assert.equal(projectedCycleDayNumber(cycle, 7), 6, 'a full lap plus one lands back on tomorrow');
});

test('cycleWorkoutName does not repeat a label that already names the day (the reported "Day 1 — Day 1")', () => {
  assert.equal(cycleWorkoutName('Day 1', 1), 'Day 1');
  assert.equal(cycleWorkoutName('day 3', 3), 'day 3');
  assert.equal(cycleWorkoutName('Push', 1), 'Push — Day 1');
  assert.equal(cycleWorkoutName('Day 2 — Pull', 2), 'Day 2 — Pull');
});

test('a six-day program keeps running after the cycle ends', () => {
  // The reported behaviour: submit a 6-day plan, work through it, and the program is over.
  const days = Array.from({ length: 6 }, (_, i) => ({ label: `Day ${i + 1}` }));
  let cycle = normalizeCycle({ lengthDays: 6, currentDay: 1, days });

  const walked: number[] = [];
  for (let i = 0; i < 13; i += 1) {
    walked.push(cycle.currentDay);
    cycle = completeCurrentCycleDay(cycle);
  }

  assert.deepEqual(walked, [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1], 'the plan restarts instead of running out');
  assert.equal(cycle.days.length, 6, 'the submitted template is still there after two full laps');
  assert.equal(cycle.days[3]?.label, 'Day 4');
});

test('the two-week lookahead projects the next lap of a six-day program', () => {
  const cycle = { currentDay: 1, lengthDays: 6 };
  const window = Array.from({ length: 14 }, (_, offset) => projectedCycleDayNumber(cycle, offset));
  assert.deepEqual(window, [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1, 2], 'day 7 onward is the plan starting over');
});

test('a date whose planned row already matches the cycle is left alone', () => {
  // Re-materializing mints a new planned_workout id, and the Workout tab holds the id it rendered.
  assert.equal(
    needsCycleDayMaterialization([{ status: 'planned', metadata: { cycleDay: 3, cycleVersion: 1 } }], 3, 1),
    false,
  );
  assert.equal(
    needsCycleDayMaterialization([{ status: 'planned', metadata: { cycleDay: 4, cycleVersion: 1 } }], 3, 1),
    true,
    'the cycle moved on, so the date has to be rewritten',
  );
  assert.equal(
    needsCycleDayMaterialization([{ status: 'planned', metadata: { cycleDay: 3, cycleVersion: 1 } }], 3, 2),
    true,
    'an edited template is a new version and must replace the old day',
  );
  assert.equal(needsCycleDayMaterialization([], 1, 1), true, 'an empty date needs filling');
});

test('materialization never touches a day the lifter has already started or finished', () => {
  for (const status of ['completed', 'active', 'in_progress', 'paused']) {
    assert.equal(
      needsCycleDayMaterialization([{ status, metadata: { cycleDay: 9, cycleVersion: 1 } }], 1, 1),
      false,
      `${status} is history or in flight — never rewrite it`,
    );
  }
});

test('a rest day with nothing scheduled is already correct', () => {
  // Rest days write no row, so treating an empty date as "needs materializing" cost a write for
  // every rest day on every pass — the reason topping the window up used to be expensive.
  assert.equal(needsCycleDayMaterialization([], 2, 1, { isRest: true }), false);
  assert.equal(
    needsCycleDayMaterialization([{ status: 'planned', metadata: { cycleDay: 2, cycleVersion: 1 } }], 2, 1, { isRest: true }),
    true,
    'a leftover workout on what is now a rest day still has to be cleared',
  );
});

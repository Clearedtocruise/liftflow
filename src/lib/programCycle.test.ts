import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceCycleDay,
  applyCycleTemplateEdit,
  clampCycleLength,
  completeCurrentCycleDay,
  currentCycleDay,
  describeCycleProgress,
  normalizeCurrentDay,
  normalizeCycle,
  CYCLE_MAX_DAYS,
} from './programCycle';
import type { TemplateExercise } from '@/types/training';

function ex(name: string, sets = 3): TemplateExercise {
  return { name, exerciseName: name, sets, repRange: '8-10' };
}

test('cycle length is clamped to 1..30', () => {
  assert.equal(clampCycleLength(0), 1);
  assert.equal(clampCycleLength(-4), 1);
  assert.equal(clampCycleLength(31), 30);
  assert.equal(clampCycleLength(7), 7);
  assert.equal(clampCycleLength(30), 30);
  assert.equal(clampCycleLength(30.4), 30);
});

test('a 1-day program always loops back to Day 1', () => {
  assert.equal(advanceCycleDay(1, 1), 1);
  const cycle = normalizeCycle({ lengthDays: 1, currentDay: 1, days: [{ label: 'Full Body', exercises: [ex('Squat')] }] });
  const after = completeCurrentCycleDay(cycle);
  assert.equal(after.currentDay, 1);
});

test('a 7-day program rolls Day 7 back to Day 1', () => {
  assert.equal(advanceCycleDay(6, 7), 7);
  assert.equal(advanceCycleDay(7, 7), 1);
  let cycle = normalizeCycle({
    lengthDays: 7,
    currentDay: 1,
    days: Array.from({ length: 7 }, (_, i) => ({ label: `Day ${i + 1}`, isRest: i === 3 || i === 6 })),
  });
  const days: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    days.push(cycle.currentDay);
    cycle = completeCurrentCycleDay(cycle);
  }
  assert.deepEqual(days, [1, 2, 3, 4, 5, 6, 7, 1, 2]);
});

test('a 30-day program rolls Day 30 back to Day 1', () => {
  assert.equal(advanceCycleDay(29, 30), 30);
  assert.equal(advanceCycleDay(30, 30), 1);
  const cycle = normalizeCycle({ lengthDays: 30, currentDay: 30, days: Array.from({ length: 30 }, () => ({})) });
  assert.equal(cycle.days.length, 30);
  assert.equal(completeCurrentCycleDay(cycle).currentDay, 1);
});

test('the 10-day example advances Push→…→Legs then back to Day 1', () => {
  const labels = ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Lower', 'Rest', 'Push', 'Pull', 'Legs'];
  let cycle = normalizeCycle({
    lengthDays: 10,
    currentDay: 10,
    days: labels.map((label) => ({ label, isRest: label === 'Rest' })),
  });
  assert.equal(currentCycleDay(cycle)?.label, 'Legs');
  cycle = completeCurrentCycleDay(cycle);
  assert.equal(cycle.currentDay, 1);
  assert.equal(currentCycleDay(cycle)?.label, 'Push');
});

test('rest days advance like any other day and carry no exercises', () => {
  const cycle = normalizeCycle({
    lengthDays: 3,
    currentDay: 1,
    days: [
      { label: 'Push', exercises: [ex('Bench Press')] },
      { label: 'Rest', isRest: true, exercises: [ex('Should be dropped')] },
      { label: 'Pull', exercises: [ex('Row')] },
    ],
  });
  assert.equal(cycle.days[1]?.isRest, true);
  assert.deepEqual(cycle.days[1]?.exercises, []);
  const afterPush = completeCurrentCycleDay(cycle);
  assert.equal(afterPush.currentDay, 2);
  assert.equal(currentCycleDay(afterPush)?.isRest, true);
  const afterRest = completeCurrentCycleDay(afterPush);
  assert.equal(afterRest.currentDay, 3);
});

test('normalizeCurrentDay wraps out-of-range pointers', () => {
  assert.equal(normalizeCurrentDay(0, 7), 7);
  assert.equal(normalizeCurrentDay(8, 7), 1);
  assert.equal(normalizeCurrentDay(15, 7), 1);
  assert.equal(normalizeCurrentDay(-1, 7), 6);
});

test('editing an active program preserves the current-day pointer (future-only change)', () => {
  let cycle = normalizeCycle({
    lengthDays: 5,
    currentDay: 3,
    days: [{ label: 'Push' }, { label: 'Pull' }, { label: 'Legs' }, { label: 'Upper' }, { label: 'Lower' }],
  });
  const startVersion = cycle.version;
  // User is on Day 3, edits Day 5's exercises and renames Day 1.
  cycle = applyCycleTemplateEdit(cycle, {
    days: [
      { label: 'Chest Day', exercises: [ex('Incline Press')] },
      { label: 'Pull' },
      { label: 'Legs' },
      { label: 'Upper' },
      { label: 'Lower', exercises: [ex('Deadlift', 5)] },
    ],
  });
  assert.equal(cycle.currentDay, 3, 'pointer must not move when the template is edited');
  assert.equal(cycle.version, startVersion + 1, 'template version bumps so clients see the change');
  assert.equal(cycle.days[0]?.label, 'Chest Day');
  assert.equal(cycle.days[4]?.exercises[0]?.name, 'Deadlift');
});

test('shrinking a program below the current day wraps the pointer back into range', () => {
  const cycle = normalizeCycle({ lengthDays: 10, currentDay: 8, days: Array.from({ length: 10 }, () => ({})) });
  const shrunk = applyCycleTemplateEdit(cycle, { lengthDays: 5, days: Array.from({ length: 5 }, () => ({})) });
  assert.equal(shrunk.lengthDays, 5);
  assert.ok(shrunk.currentDay >= 1 && shrunk.currentDay <= 5);
  assert.equal(shrunk.currentDay, normalizeCurrentDay(8, 5));
});

test('describeCycleProgress reports the live day for UI', () => {
  const cycle = normalizeCycle({
    lengthDays: 4,
    currentDay: 2,
    days: [{ label: 'Push' }, { label: 'Rest', isRest: true }, { label: 'Pull' }, { label: 'Legs' }],
  });
  const progress = describeCycleProgress(cycle);
  assert.equal(progress.dayNumber, 2);
  assert.equal(progress.lengthDays, 4);
  assert.equal(progress.label, 'Rest');
  assert.equal(progress.isRest, true);
});

test('a program cannot exceed 30 days even if more days are supplied', () => {
  const cycle = normalizeCycle({ lengthDays: 45, days: Array.from({ length: 45 }, () => ({})) });
  assert.equal(cycle.lengthDays, CYCLE_MAX_DAYS);
  assert.equal(cycle.days.length, CYCLE_MAX_DAYS);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeStrengthTrend, type LoggedSet } from './strengthTrend.js';

function set(exercise: string, date: string, weight: number, reps: number): LoggedSet {
  return { exercise, date: `${date}T12:00:00.000Z`, weight, reps };
}

test('reports an upward direction when the top set grows', () => {
  const summary = summarizeStrengthTrend([
    set('Bench Press', '2026-06-01', 100, 5),
    set('Bench Press', '2026-06-15', 115, 5),
  ]);

  const bench = summary.entries.find((e) => e.exercise === 'Bench Press');
  assert.ok(bench, 'bench press must appear in the trend');
  assert.equal(bench.direction, 'up');
  assert.equal(bench.sessions, 2);
  assert.equal(bench.daysCovered, 14);
  assert.deepEqual(bench.firstTopSet, { weight: 100, reps: 5 });
  assert.deepEqual(bench.lastTopSet, { weight: 115, reps: 5 });
  assert.ok(bench.deltaEstimated1rm > 0, 'estimated 1RM must increase');
});

test('extra reps at the same load still count as progress', () => {
  const summary = summarizeStrengthTrend([
    set('Deadlift', '2026-06-01', 140, 3),
    set('Deadlift', '2026-06-20', 140, 8),
  ]);

  assert.equal(summary.entries[0].direction, 'up');
});

test('flags an exercise ground for three weeks with no gain as stalled', () => {
  const summary = summarizeStrengthTrend([
    set('Squat', '2026-06-01', 150, 5),
    set('Squat', '2026-06-10', 150, 5),
    set('Squat', '2026-06-22', 150, 5),
  ]);

  const squat = summary.entries[0];
  assert.equal(squat.direction, 'flat');
  assert.equal(squat.sessions, 3);
  assert.equal(squat.daysCovered, 21);
  assert.deepEqual(summary.stalledExercises, ['Squat']);
});

test('a declining exercise trained long enough is also stalled', () => {
  const summary = summarizeStrengthTrend([
    set('Overhead Press', '2026-06-01', 60, 8),
    set('Overhead Press', '2026-06-10', 60, 6),
    set('Overhead Press', '2026-06-18', 50, 5),
  ]);

  assert.equal(summary.entries[0].direction, 'down');
  assert.deepEqual(summary.stalledExercises, ['Overhead Press']);
});

test('two sessions in one week are not enough to call a stall', () => {
  const summary = summarizeStrengthTrend([
    set('Row', '2026-06-01', 80, 10),
    set('Row', '2026-06-04', 80, 10),
  ]);

  assert.equal(summary.entries[0].direction, 'flat');
  assert.deepEqual(summary.stalledExercises, [], 'a 3-day window cannot establish a plateau');
});

test('a single training day yields no direction', () => {
  const summary = summarizeStrengthTrend([
    set('Curl', '2026-06-01', 20, 12),
    set('Curl', '2026-06-01', 22, 10),
  ]);

  assert.deepEqual(summary.entries, []);
});

test('the heaviest set of a day represents that day, ties broken on reps', () => {
  const summary = summarizeStrengthTrend([
    set('Bench Press', '2026-06-01', 80, 12),
    set('Bench Press', '2026-06-01', 100, 3),
    set('Bench Press', '2026-06-01', 100, 6),
    set('Bench Press', '2026-06-15', 105, 5),
  ]);

  assert.deepEqual(summary.entries[0].firstTopSet, { weight: 100, reps: 6 });
});

test('unlogged weights and reps are ignored rather than read as zero progress', () => {
  const summary = summarizeStrengthTrend([
    set('Plank', '2026-06-01', 0, 0),
    set('Plank', '2026-06-10', 0, 0),
    set('Bench Press', '2026-06-01', 100, 5),
    set('Bench Press', '2026-06-10', 110, 5),
  ]);

  assert.deepEqual(
    summary.entries.map((e) => e.exercise),
    ['Bench Press'],
  );
});

test('most-trained exercises win the cap on how many are reported', () => {
  const sets: LoggedSet[] = [];
  for (const [index, name] of ['A', 'B', 'C', 'D', 'E', 'F'].entries()) {
    // A gets 7 days, B 6, ... F 2 — so F must be the one dropped by the default cap of 5.
    for (let day = 1; day <= 7 - index; day += 1) {
      sets.push(set(name, `2026-06-0${day}`, 100, 5));
    }
  }

  const summary = summarizeStrengthTrend(sets);
  assert.equal(summary.entries.length, 5);
  assert.deepEqual(
    summary.entries.map((e) => e.exercise),
    ['A', 'B', 'C', 'D', 'E'],
  );
});

test('an empty log produces an empty summary rather than throwing', () => {
  const summary = summarizeStrengthTrend([]);
  assert.deepEqual(summary.entries, []);
  assert.deepEqual(summary.stalledExercises, []);
});

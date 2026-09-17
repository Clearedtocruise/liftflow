/**
 * A session finished today has to stay visible on the home screen.
 *
 * Picking one canonical row per date ranks a startable workout above a finished one, which is
 * right for deciding what to start next and wrong for deciding what has been done. When a planned
 * row landed on a day already trained — a day moved there, or a cycle day rewritten after a swap —
 * the finished session disappeared and home asked the lifter to start what they had just done.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActiveTrainingDay } from './activeTrainingDay';

import type { PlannedWorkout } from '@/types/training';

// A Thursday, so the week window that the resolver builds around it is unambiguous.
const TODAY = '2026-09-17';
const REFERENCE = new Date(`${TODAY}T12:00:00Z`);

function workout(overrides: Partial<PlannedWorkout> & { id: string; status: string }): PlannedWorkout {
  return {
    name: 'Day 1',
    scheduledDate: TODAY,
    suggestedMuscleGroups: [],
    metadata: {},
    ...overrides,
  } as PlannedWorkout;
}

const resolve = (workouts: PlannedWorkout[]) =>
  resolveActiveTrainingDay(workouts, { date: TODAY, reference: REFERENCE });

test('a finished session is reported for the day it was finished on', () => {
  const day = resolve([workout({ id: 'done', status: 'completed', name: 'Day 1' })]);
  assert.equal(day.completedWorkout?.id, 'done');
});

test('a workout moved onto a day already trained does not erase it', () => {
  const day = resolve([
    workout({ id: 'done', status: 'completed', name: 'Day 1' }),
    workout({ id: 'moved-in', status: 'planned', name: 'Day 2' }),
  ]);

  assert.equal(day.completedWorkout?.id, 'done', 'the finished session was lost');
  // The moved-in day is still what there is to start, so neither answer is given up for the other.
  assert.equal(day.workout?.id, 'moved-in');
  assert.equal(day.isStartableWorkoutDay, true);
});

test('row order does not decide whether the day counts as trained', () => {
  const planned = workout({ id: 'moved-in', status: 'planned', name: 'Day 2' });
  const done = workout({ id: 'done', status: 'completed', name: 'Day 1' });

  assert.equal(resolve([planned, done]).completedWorkout?.id, 'done');
  assert.equal(resolve([done, planned]).completedWorkout?.id, 'done');
});

test('a day with nothing finished on it reports nothing finished', () => {
  const day = resolve([workout({ id: 'today', status: 'planned' })]);
  assert.equal(day.completedWorkout, null);
});

test("another day's finished session is not borrowed", () => {
  const day = resolve([
    workout({ id: 'yesterday', status: 'completed', scheduledDate: '2026-09-16' }),
    workout({ id: 'today', status: 'planned' }),
  ]);
  assert.equal(day.completedWorkout, null);
});

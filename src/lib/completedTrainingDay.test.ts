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

import { resolveActiveTrainingDay, resolveDayEngagement } from './activeTrainingDay';
import { dedupePlannedWorkoutsByDate } from './weekPlan';

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

/**
 * The resolver is only ever handed rows that `trainingService.getPlannedWorkouts` has already
 * deduped, so its own undeduped lookup has nothing left to find. Guarding the resolver in
 * isolation passed while the screen it protects still lost the session.
 */
test('deduping before the resolver runs drops the finished session', () => {
  const rows = [
    workout({ id: 'done', status: 'completed', name: 'Day 1' }),
    workout({ id: 'moved-in', status: 'planned', name: 'Day 2' }),
  ];

  const asTheServiceReturnsThem = dedupePlannedWorkoutsByDate(rows, REFERENCE);

  assert.equal(
    asTheServiceReturnsThem.some((row) => row.id === 'done'),
    false,
    'this is the drop that has to be worked around, not a behaviour to rely on',
  );
  assert.equal(
    resolveActiveTrainingDay(asTheServiceReturnsThem, { date: TODAY, reference: REFERENCE })
      .completedWorkout,
    null,
    'the finished session cannot be recovered from a deduped list',
  );
});

/**
 * `planned` outranks every status a row moves into once it has been trained, so one duplicate
 * left behind on the day hides the whole of it — not just a finished session but one still
 * underway, which is why home could offer to start a workout that was already in progress.
 */
const ENGAGED_STATUSES = ['active', 'paused', 'completed'] as const;
const UNDERWAY_STATUSES = ['active', 'paused'] as const;

for (const status of ENGAGED_STATUSES) {
  test(`a stale planned duplicate hides a '${status}' row from the week`, () => {
    const deduped = dedupePlannedWorkoutsByDate(
      [workout({ id: 'worked', status }), workout({ id: 'stale-dupe', status: 'planned' })],
      REFERENCE,
    );

    assert.deepEqual(
      deduped.map((row) => row.id),
      ['stale-dupe'],
      'the row the work went into is the one that gets dropped',
    );
    assert.equal(
      resolveActiveTrainingDay(deduped, { date: TODAY, reference: REFERENCE })
        .isStartableWorkoutDay,
      true,
      'so the day still invites the lifter to start it',
    );
  });
}

test('the day reports what was finished on it even behind a stale duplicate', () => {
  const engagement = resolveDayEngagement(
    [workout({ id: 'done', status: 'completed' }), workout({ id: 'stale-dupe', status: 'planned' })],
    TODAY,
  );
  assert.equal(engagement.completed?.id, 'done');
  assert.equal(engagement.inProgress, null);
});

for (const status of UNDERWAY_STATUSES) {
  test(`the day reports a '${status}' session even behind a stale duplicate`, () => {
    const engagement = resolveDayEngagement(
      [workout({ id: 'underway', status }), workout({ id: 'stale-dupe', status: 'planned' })],
      TODAY,
    );
    assert.equal(engagement.inProgress?.id, 'underway');
    assert.equal(engagement.completed, null);
  });
}

test('a day with nothing but planned rows reports no engagement', () => {
  const engagement = resolveDayEngagement(
    [workout({ id: 'a', status: 'planned' }), workout({ id: 'b', status: 'planned' })],
    TODAY,
  );
  assert.equal(engagement.completed, null);
  assert.equal(engagement.inProgress, null);
});

test("engagement is not borrowed from another day's rows", () => {
  const engagement = resolveDayEngagement(
    [
      workout({ id: 'yesterday', status: 'completed', scheduledDate: '2026-09-16' }),
      workout({ id: 'today', status: 'planned' }),
    ],
    TODAY,
  );
  assert.equal(engagement.completed, null);
  assert.equal(engagement.inProgress, null);
});

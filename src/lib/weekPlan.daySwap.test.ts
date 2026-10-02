import assert from 'node:assert/strict';
import test from 'node:test';

import type { PlannedWorkout } from '@/types/training';

import { patchPlannedWorkoutsForChange } from './weekPlan';

function workout(partial: Partial<PlannedWorkout> & Pick<PlannedWorkout, 'id' | 'scheduledDate' | 'name'>): PlannedWorkout {
  return {
    status: 'planned',
    userId: 'u',
    suggestedMuscleGroups: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  } as PlannedWorkout;
}

test('swap exchanges the two days and drops a leftover copy on either date', () => {
  const monday = workout({ id: 'push', name: 'Push', scheduledDate: '2026-10-05' });
  const thursday = workout({ id: 'legs', name: 'Legs', scheduledDate: '2026-10-08' });
  const leftover = workout({ id: 'push-copy', name: 'Push', scheduledDate: '2026-10-05' });

  const next = patchPlannedWorkoutsForChange([monday, thursday, leftover], {
    type: 'swap',
    workoutIdA: 'push',
    workoutIdB: 'legs',
  });

  const byId = new Map(next.map((row) => [row.id, row.scheduledDate]));
  assert.equal(byId.get('push'), '2026-10-08');
  assert.equal(byId.get('legs'), '2026-10-05');
  assert.equal(byId.has('push-copy'), false);
  assert.equal(next.find((row) => row.id === 'push')?.name, 'Push');
});

test('moving onto another workout exchanges the two days and keeps both names', () => {
  const push = workout({ id: 'push', name: 'Push', scheduledDate: '2026-10-05', status: 'active' });
  const legs = workout({ id: 'legs', name: 'Legs', scheduledDate: '2026-10-07', status: 'planned' });

  const next = patchPlannedWorkoutsForChange([push, legs], {
    type: 'move',
    workoutId: 'push',
    toDate: '2026-10-07',
  });

  const byId = new Map(next.map((row) => [row.id, row]));
  assert.equal(byId.get('push')?.scheduledDate, '2026-10-07');
  assert.equal(byId.get('legs')?.scheduledDate, '2026-10-05');
  assert.equal(byId.get('push')?.name, 'Push');
  assert.equal(byId.get('legs')?.name, 'Legs');
});

test('moving onto a rest day takes the workout off the old day', () => {
  const push = workout({ id: 'push', name: 'Push', scheduledDate: '2026-10-05' });
  const copy = workout({ id: 'push-copy', name: 'Push', scheduledDate: '2026-10-05' });

  const next = patchPlannedWorkoutsForChange([push, copy], {
    type: 'move',
    workoutId: 'push',
    toDate: '2026-10-07',
  });

  assert.deepEqual(
    next.map((row) => row.id),
    ['push'],
  );
  assert.equal(next[0]?.scheduledDate, '2026-10-07');
  assert.equal(next[0]?.name, 'Push');
});

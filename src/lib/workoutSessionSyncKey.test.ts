import assert from 'node:assert/strict';
import test from 'node:test';

import { workoutSessionSyncKey } from './workoutSessionSyncKey';
import type { WorkoutSession, WorkoutSet } from '@/types';

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    name: 'Push',
    status: 'active',
    startedAt: '2026-09-25T12:00:00Z',
    exercises: [
      {
        id: 'ex-1',
        sessionId: 'session-1',
        exerciseId: 'bench',
        sortOrder: 0,
        sets: [
          {
            id: 'set-1',
            workoutExerciseId: 'ex-1',
            setNumber: 1,
            weight: 100,
            reps: 8,
            type: 'normal',
            loggedAt: '2026-09-25T12:01:00Z',
            createdAt: '2026-09-25T12:01:00Z',
          },
        ],
        createdAt: '2026-09-25T12:00:00Z',
      },
    ],
    createdAt: '2026-09-25T12:00:00Z',
    ...overrides,
  } as WorkoutSession;
}

test('an identical refetch keeps the same key', () => {
  assert.equal(workoutSessionSyncKey(session()), workoutSessionSyncKey(session()));
});

test('logging another set changes the key', () => {
  const before = session();
  const after = session();
  const extra: WorkoutSet = {
    id: 'set-2',
    workoutExerciseId: 'ex-1',
    setNumber: 2,
    weight: 100,
    reps: 8,
    type: 'normal',
    loggedAt: '2026-09-25T12:03:00Z',
    createdAt: '2026-09-25T12:03:00Z',
  };
  after.exercises[0].sets = [...before.exercises[0].sets, extra];
  assert.notEqual(workoutSessionSyncKey(before), workoutSessionSyncKey(after));
});

test('editing the load on a set changes the key', () => {
  const before = session();
  const after = session();
  after.exercises[0].sets = [{ ...before.exercises[0].sets[0], weight: 110 }];
  assert.notEqual(workoutSessionSyncKey(before), workoutSessionSyncKey(after));
});

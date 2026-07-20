import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyOptimisticSetToSession } from '@/lib/pendingSetSync';
import type { CreateSetPayload, WorkoutSession } from '@/types';

describe('optimistic set logging', () => {
  it('applies a pending set without waiting on the network', () => {
    const session = {
      id: 's1',
      userId: 'u1',
      name: 'Test',
      status: 'active',
      startedAt: '2026-07-20T00:00:00Z',
      exercises: [
        {
          id: 'we1',
          exerciseId: 'ex1',
          sortOrder: 0,
          sets: [],
          exercise: {
            id: 'ex1',
            name: 'Bench Press',
            category: 'push',
            exerciseType: 'strength',
            equipment: 'barbell',
            muscleGroups: ['chest'],
            isSystem: true,
            createdAt: '2026-01-01',
          },
        },
      ],
    } as WorkoutSession;

    const payload: CreateSetPayload = {
      workoutExerciseId: 'we1',
      weight: 60,
      reps: 8,
      restSeconds: 90,
    };

    const { session: next, set } = applyOptimisticSetToSession(session, payload, 'local-1');
    assert.equal(next.exercises[0]?.sets.length, 1);
    assert.equal(set.weight, 60);
    assert.equal(set.reps, 8);
    assert.equal(set.pendingSync, true);
    assert.match(set.id, /^pending-local-1$/);
  });
});

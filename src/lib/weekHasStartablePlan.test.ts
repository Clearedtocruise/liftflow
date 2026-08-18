import assert from 'node:assert/strict';
import test from 'node:test';

import { isStartableWorkoutStatus } from './weekPlan';

test('cancelled leftovers are not a startable week', () => {
  assert.equal(isStartableWorkoutStatus('cancelled'), false);
  assert.equal(isStartableWorkoutStatus('planned'), true);
  assert.equal(isStartableWorkoutStatus('completed'), false);
});

test('an empty week is empty when every row is cancelled', () => {
  const week = [{ status: 'cancelled' }, { status: 'cancelled' }];
  const hasStartable = week.some((workout) => isStartableWorkoutStatus(workout.status));
  assert.equal(hasStartable, false);
});

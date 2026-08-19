import assert from 'node:assert/strict';
import test from 'node:test';

import { exercisesFromPlannedWorkout, preferPlannedSetCounts } from './workoutPlan';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

function planExercise(
  name: string,
  sets: number,
): EditableWorkoutExercise {
  return {
    id: name,
    name,
    sets,
    repRange: '5',
  };
}

test('a 5-set pull-up is not collapsed to the 3-set draft default', () => {
  const live = [planExercise('Pull-Up', 3), planExercise('Barbell Row', 3)];
  const planned = [planExercise('Pull-Up', 5), planExercise('Barbell Row', 5)];
  const merged = preferPlannedSetCounts(live, planned);
  assert.equal(merged[0]?.sets, 5);
  assert.equal(merged[1]?.sets, 5);
});

test('planned set counts match by name when session order drifts', () => {
  const live = [planExercise('Barbell Row', 3), planExercise('Pull-Up', 3)];
  const planned = [planExercise('Pull-Up', 5), planExercise('Barbell Row', 5)];
  const merged = preferPlannedSetCounts(live, planned);
  assert.equal(merged[0]?.name, 'Barbell Row');
  assert.equal(merged[0]?.sets, 5);
  assert.equal(merged[1]?.sets, 5);
});

test('Pull-Up in the PDF still overlays the catalog Pull Up row', () => {
  const live = [planExercise('Pull Up', 3), planExercise('Barbell Row', 3)];
  const planned = [planExercise('Pull-Up', 5), planExercise('Barbell Row', 5)];
  const merged = preferPlannedSetCounts(live, planned);
  assert.equal(merged[0]?.sets, 5);
});

test('aggressive-cut day 1 metadata keeps pull-ups at 5 sets', () => {
  const workout = {
    metadata: {
      exercises: [
        { name: 'Pull-Up', sets: 5, reps: '5', restSeconds: 180 },
        { name: 'Barbell Row', sets: 5, reps: '6', restSeconds: 150 },
      ],
    },
  } as PlannedWorkout;
  const exercises = exercisesFromPlannedWorkout(workout);
  assert.equal(exercises[0]?.name, 'Pull-Up');
  assert.equal(exercises[0]?.sets, 5);
});

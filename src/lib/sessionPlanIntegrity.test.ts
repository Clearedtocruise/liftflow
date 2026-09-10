import assert from 'node:assert/strict';
import test from 'node:test';

import { missingPlanExerciseNames } from './sessionPlanIntegrity';

test('reports the lift that sits between RDL and calves when the session dropped it', () => {
  assert.deepEqual(
    missingPlanExerciseNames(
      ['Back Squat', 'Romanian Deadlift', 'Walking Lunge', 'Calf Raise', 'Side Plank'],
      ['Back Squat', 'Romanian Deadlift', 'Calf Raise', 'Side Plank'],
    ),
    ['Walking Lunge'],
  );
});

test('treats plural and hyphen spellings as present', () => {
  assert.deepEqual(
    missingPlanExerciseNames(
      ['Pull Ups', 'Barbell Rows', 'Calf Raises'],
      ['Pull-Up', 'Barbell Row', 'Calf Raise'],
    ),
    [],
  );
});

test('an empty session is missing every planned lift', () => {
  assert.deepEqual(missingPlanExerciseNames(['RDL', 'Calf Raise'], []), ['RDL', 'Calf Raise']);
});

test('extra session lifts do not count as missing plan lifts', () => {
  assert.deepEqual(
    missingPlanExerciseNames(
      ['Romanian Deadlift', 'Calf Raise'],
      ['Romanian Deadlift', 'Walking Lunge', 'Calf Raise'],
    ),
    [],
  );
});

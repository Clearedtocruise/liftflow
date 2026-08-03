import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyExercise } from './exerciseClassification';
import { getExerciseLoggingMode } from './exerciseModality';

test('Hammer Row is strength, not cardio distance', () => {
  assert.equal(
    classifyExercise({
      slug: 'hammer-row',
      name: 'Hammer Row',
      equipment: 'dumbbell',
      exerciseType: 'strength',
    }),
    'strength',
  );
  assert.equal(
    getExerciseLoggingMode({
      id: 'x',
      name: 'Hammer Row',
      slug: 'hammer-row',
      equipment: 'dumbbell',
      exerciseType: 'strength',
      category: 'pull',
      muscleGroups: ['back'],
    } as never),
    'weighted',
  );
});

test('loaded strength rows keep weighted logging so between-set rest is not skipped', () => {
  // ActiveWorkoutScreen hardcodes skipRest:true when loggingMode === 'cardio'.
  const mode = getExerciseLoggingMode({
    id: 'x',
    name: 'Hammer Row',
    slug: 'hammer-row',
    equipment: 'machine',
    exerciseType: 'strength',
    category: 'pull',
    muscleGroups: ['back'],
  } as never);
  assert.equal(mode, 'weighted');
  assert.notEqual(mode, 'cardio');
});

test('Hammer Low Row stays weighted', () => {
  assert.equal(classifyExercise({ name: 'Hammer Low Row', equipment: 'machine' }), 'strength');
  assert.equal(getExerciseLoggingMode(null, null, 'Hammer Low Row'), 'weighted');
});

test('Rowing / rower still classify as cardio', () => {
  assert.equal(classifyExercise({ name: 'Rowing', equipment: 'rower' }), 'cardio');
  assert.equal(classifyExercise({ name: 'Concept 2 rower' }), 'cardio');
  assert.equal(getExerciseLoggingMode(null, null, 'Rowing'), 'cardio');
});

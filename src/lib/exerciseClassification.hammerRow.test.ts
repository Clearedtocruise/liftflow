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
      isSystem: true,
      createdAt: '',
    }),
    'weighted',
  );
});

test('Hammer Curl is strength, not cardio distance', () => {
  assert.equal(
    classifyExercise({
      slug: 'hammer-curl',
      name: 'Hammer Curl',
      equipment: 'dumbbell',
      exerciseType: 'strength',
    }),
    'strength',
  );
  assert.equal(
    getExerciseLoggingMode({
      id: 'x',
      name: 'Hammer Curl',
      slug: 'hammer-curl',
      equipment: 'dumbbell',
      exerciseType: 'strength',
      category: 'pull',
      muscleGroups: ['biceps'],
      isSystem: true,
      createdAt: '',
    }),
    'weighted',
  );
  assert.equal(getExerciseLoggingMode(null, null, 'Hammer Curl'), 'weighted');
  assert.equal(getExerciseLoggingMode(null, null, 'Dumbbell Hammer Curl'), 'weighted');
});

test('Hammer Low Row stays weighted', () => {
  assert.equal(classifyExercise({ name: 'Hammer Low Row', equipment: 'machine' }), 'strength');
  assert.equal(getExerciseLoggingMode(null, null, 'Hammer Low Row'), 'weighted');
});

test('Walking Lunge is not cardio from walk substring', () => {
  assert.equal(
    classifyExercise({ name: 'Walking Lunge', equipment: 'bodyweight' }),
    'bodyweight',
  );
});

test('Rowing / rower still classify as cardio', () => {
  assert.equal(classifyExercise({ name: 'Rowing', equipment: 'rower' }), 'cardio');
  assert.equal(classifyExercise({ name: 'Concept 2 rower' }), 'cardio');
  assert.equal(getExerciseLoggingMode(null, null, 'Rowing'), 'cardio');
});

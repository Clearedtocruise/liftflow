import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExerciseMuscles } from './exerciseMuscleMap';

test('DB Kickback resolves to triceps, never Full Body', () => {
  assert.deepEqual(resolveExerciseMuscles('DB Kickback').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('DB KICKBACK').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('Dumbbell Kickback').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('Exercise', ['full_body'], 'db-kickback').primary, ['triceps']);
  // Empty / full-body tags must not win over the kickback name.
  assert.deepEqual(resolveExerciseMuscles('DB Kickback', ['full_body']).primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('DB Kickback', []).primary, ['triceps']);
  assert.notEqual(resolveExerciseMuscles('DB Kickback').primary[0], 'full-body');
});

test('glute cable kickback stays glutes', () => {
  assert.deepEqual(resolveExerciseMuscles('Cable Kickback').primary, ['glutes']);
  assert.deepEqual(resolveExerciseMuscles('Glute Kickback').primary, ['glutes']);
});

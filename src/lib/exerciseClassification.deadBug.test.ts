import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyExercise } from '@/lib/exerciseClassification';
import { getExerciseLoggingMode } from '@/lib/exerciseModality';
import type { Exercise } from '@/types';

/**
 * The catalog stores Dead Bug as strength, and the catalog used to win over the name, so a dead bug
 * from the catalog asked for a weight while one typed by hand did not.
 */
test('a dead bug from the catalog logs reps only', () => {
  const exercise = { slug: 'dead-bug', name: 'Dead Bug', equipment: 'bodyweight', exerciseType: 'strength' } as Exercise;
  assert.equal(getExerciseLoggingMode(exercise), 'bodyweight');
});

for (const name of ['Dead bug', 'Dead Bugs', 'Deadbugs', 'Dead-bug', 'dead bug each side']) {
  test(`"${name}" is bodyweight`, () => {
    assert.equal(classifyExercise({ name }), 'bodyweight');
  });
}

test('other unloaded core moves the catalog calls strength are bodyweight too', () => {
  assert.equal(classifyExercise({ slug: 'russian-twist', name: 'Russian Twist' }), 'bodyweight');
  assert.equal(classifyExercise({ slug: 'hanging-leg-raise', name: 'Hanging Leg Raise' }), 'bodyweight');
});

test('holding something keeps it weighted', () => {
  assert.equal(classifyExercise({ slug: 'russian-twist', name: 'Weighted Russian Twist' }), 'strength');
  assert.equal(classifyExercise({ name: 'Dumbbell Dead Bug', equipment: 'dumbbell', exerciseType: 'strength' }), 'strength');
});

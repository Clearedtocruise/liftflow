import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyExercise } from './exerciseClassification';
import { getExerciseLoggingMode } from './exerciseModality';

import type { Exercise } from '@/types';

/**
 * Leg throw downs are an ab movement — the load is the lifter's own legs. Classified as strength
 * they went to the weighted logger, which asks for a weight that does not exist.
 */
const THROW_DOWN_NAMES = [
  'Flat Leg Throw Downs',
  'Flat Leg Throw Down',
  'Flat Leg Throwdowns',
  'Leg Throw Downs',
  'Leg Throwdown',
  'leg throw-downs',
  'Throw Downs',
  'Lying Leg Throw Downs',
];

for (const name of THROW_DOWN_NAMES) {
  test(`${name} is bodyweight`, () => {
    assert.equal(classifyExercise({ name }), 'bodyweight');
  });
}

test('throw downs reach the logger as bodyweight, not weighted', () => {
  const exercise = { name: 'Flat Leg Throw Downs', exerciseType: 'strength' } as Exercise;
  assert.equal(getExerciseLoggingMode(exercise), 'bodyweight');
});

test('an import that tagged them as machine work does not drag them back to weighted', () => {
  assert.equal(
    classifyExercise({ name: 'Flat Leg Throw Downs', equipment: 'machine', exerciseType: 'strength' }),
    'bodyweight',
  );
});

/** "Push down" and "pull down" are loaded cable work and must not be swept up with "throw down". */
const STAYS_WEIGHTED = [
  'Tricep Pushdown',
  'Cable Push Down',
  'Rope Push Down',
  'Lat Pulldown',
  'Straight Arm Pull Down',
  'Leg Press',
  'Leg Curl',
  'Leg Extension',
];

for (const name of STAYS_WEIGHTED) {
  test(`${name} stays strength`, () => {
    assert.equal(classifyExercise({ name, equipment: 'cable', exerciseType: 'strength' }), 'strength');
  });
}

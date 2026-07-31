import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyExercise } from './exerciseClassification';

/** A hold is logged in seconds; classifying it as strength asks for weight and reps instead. */
const TIMED_NAMES = [
  'Plank',
  'Planks',
  'Side Plank',
  'Side Planks',
  'Wall Sit',
  'Wall Sits',
  'Dead Hang',
  'Dead Hangs',
  'Hollow Hold',
  'Hollow Holds',
  'L-Sit',
  'L Sits',
  'Static Hold',
  'Static Holds',
  'Superman Hold',
  'Farmer Carry',
  'Farmer Carries',
  'Suitcase Carry',
  'Hamstring Stretch',
];

const NOT_TIMED_NAMES = ['Bench Press', 'Barbell Row', 'Dumbbell Curl', 'Deadlift', 'Back Squat'];

test('holds classify as timed, singular or plural', () => {
  for (const name of TIMED_NAMES) {
    assert.equal(classifyExercise({ name }), 'timed', `${name} should be timed`);
  }
});

test('a plural name is treated the same as its singular', () => {
  // "Side Planks" used to miss `\bplank\b` entirely and fall through to weighted logging.
  for (const [singular, plural] of [
    ['Side Plank', 'Side Planks'],
    ['Wall Sit', 'Wall Sits'],
    ['Dead Hang', 'Dead Hangs'],
  ]) {
    assert.equal(classifyExercise({ name: singular }), classifyExercise({ name: plural }), plural);
  }
});

test('lifts are not swept up as timed', () => {
  for (const name of NOT_TIMED_NAMES) {
    assert.notEqual(classifyExercise({ name }), 'timed', `${name} should not be timed`);
  }
});

test('a specific stored type wins over the name heuristics', () => {
  assert.equal(classifyExercise({ name: 'Side Planks', exerciseType: 'cardio' }), 'cardio');
});

test('a hold stored as generic strength is still recovered as timed', () => {
  // `strength` is the table default, so a catalog row that was never classified must not force a
  // weight-and-reps prompt onto a hold.
  assert.equal(classifyExercise({ name: 'Side Planks', exerciseType: 'strength' }), 'timed');
  assert.equal(classifyExercise({ name: 'Plank', exerciseType: 'strength' }), 'timed');
});

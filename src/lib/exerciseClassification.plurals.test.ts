import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyExercise } from './exerciseClassification';
import { getExerciseLoggingMode } from './exerciseModality';

import type { Exercise } from '@/types';

/**
 * A plan names its lifts in the plural, and the classifier only recognised the singular: the
 * trailing `\b` refuses "push-ups", because "push-up" ends mid-word in it. Every one of these
 * went to the weighted logger and asked for a weight the lifter was not holding.
 */
const BODYWEIGHT_PLURALS = [
  'Decline push-ups',
  'Regular push-ups',
  'Incline push-ups',
  'Push-Ups',
  'Pull-Ups',
  'Chin-ups',
  'Bench dips',
  'Burpees',
  'Air Squats',
  'Inverted Rows',
  'Muscle-Ups',
  'Pistol Squats',
];

for (const name of BODYWEIGHT_PLURALS) {
  test(`${name} is bodyweight`, () => {
    assert.equal(classifyExercise({ name }), 'bodyweight');
  });
}

const CORE_BODYWEIGHT_PLURALS = [
  'Hanging Leg Raises',
  'Leg Raises',
  'V-Ups',
  'Mountain Climbers',
  'Russian Twists',
  'Dead Bugs',
  'Hollow Rocks',
  'Flutter Kicks',
  'Scissor Kicks',
  'Windshield Wipers',
];

for (const name of CORE_BODYWEIGHT_PLURALS) {
  test(`${name} is bodyweight`, () => {
    assert.equal(classifyExercise({ name }), 'bodyweight');
  });
}

const CORE_STRENGTH_PLURALS = ['Sit-ups', 'Crunches', 'Reverse Crunches', 'Ab Rollouts', 'Wood Chops'];

for (const name of CORE_STRENGTH_PLURALS) {
  test(`${name} stays strength`, () => {
    assert.equal(classifyExercise({ name }), 'strength');
  });
}

test('the singular still classifies the way it always did', () => {
  assert.equal(classifyExercise({ name: 'Push-Up' }), 'bodyweight');
  assert.equal(classifyExercise({ name: 'Bench Dip' }), 'bodyweight');
  assert.equal(classifyExercise({ name: 'Mountain Climber' }), 'bodyweight');
  assert.equal(classifyExercise({ name: 'Crunch' }), 'strength');
});

test('a plural name does not drag a loaded lift onto the bodyweight logger', () => {
  assert.equal(classifyExercise({ name: 'Flat dumbbell flies' }), 'strength');
  assert.equal(classifyExercise({ name: 'Dumbbell Curls' }), 'strength');
  assert.equal(classifyExercise({ name: 'Barbell Rows' }), 'strength');
  assert.equal(classifyExercise({ name: 'Lateral Raises' }), 'strength');
});

test('push-ups imported as strength reach the logger as bodyweight', () => {
  const exercise = { name: 'Decline push-ups', exerciseType: 'strength' } as Exercise;
  assert.equal(getExerciseLoggingMode(exercise), 'bodyweight');
});

/** A rowing machine is cardio however it is written; a barbell row is not. */
test('plurals do not confuse rowing with rows', () => {
  assert.equal(classifyExercise({ name: 'Rowing Machines' }), 'cardio');
  assert.equal(
    classifyExercise({ name: 'Hammer Rows', equipment: 'machine', exerciseType: 'strength' }),
    'strength',
  );
});

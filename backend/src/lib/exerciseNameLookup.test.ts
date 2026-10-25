import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exerciseCanonicalKey,
  exerciseCompactKey,
  exerciseNamePattern,
  exerciseNamePatterns,
  namesMatchExercise,
} from './exerciseNameLookup.js';

// Mirrors src/lib/exerciseNameLookup.test.ts — the two copies must agree.

test('the duplicate catalog rows that split a lift history are one lift', () => {
  // Really in the catalog: a seeded row beside a custom row the app minted when exact-name
  // matching missed, each holding half the history.
  assert.ok(namesMatchExercise('Decline push-ups', 'Decline Push-Up'));
  assert.ok(namesMatchExercise('Step-Ups', 'Step-Up'));
  assert.ok(namesMatchExercise('Weighted Situps', 'Weighted Sit-Up'));
  assert.ok(!namesMatchExercise('Step-Ups', 'Poliquin Step-Up'));
  assert.ok(!namesMatchExercise('Decline push-ups', 'Diamond Push-Up'));
});

test('a compound inside a longer name collapses onto the catalog spelling', () => {
  assert.equal(exerciseCanonicalKey('Decline Push-Ups'), 'decline push up');
  assert.equal(exerciseCanonicalKey('Decline Pushups'), 'decline push up');
  assert.equal(exerciseCanonicalKey('Decline Push Up'), 'decline push up');
  assert.ok(namesMatchExercise('Decline Push-Ups', 'Decline Pushups'));
  assert.ok(namesMatchExercise('Wide Grip Pull-Ups', 'Wide Grip Pullups'));
  assert.ok(!namesMatchExercise('Decline Push-Ups', 'Incline Push-Ups'));
});

test('plural and hyphenated spellings are one lift', () => {
  assert.ok(namesMatchExercise('Pull Ups', 'Pull-Up'));
  assert.ok(namesMatchExercise('Barbell Rows', 'Barbell Row'));
  assert.ok(namesMatchExercise('Bench Presses', 'Bench Press'));
  assert.ok(namesMatchExercise('Crunches', 'Crunch'));
  assert.ok(!namesMatchExercise('Pull Up', 'Barbell Row'));
});

test('lifts split into different words still match', () => {
  assert.ok(namesMatchExercise('Lat Pulldown', 'Lat Pull Down'));
  assert.ok(namesMatchExercise('Deadlift', 'Dead Lift'));
  assert.equal(exerciseCompactKey('Bench Presses'), 'benchpress');
  assert.equal(exerciseCompactKey('Bench Press'), 'benchpress');
  assert.ok(!namesMatchExercise('Deadlift', 'Romanian Deadlift'));
});

test('the lookup pattern reaches every spelling of a lift', () => {
  assert.equal(exerciseNamePattern('Decline Push-Ups'), '%decline%push%up%');
  assert.equal(exerciseNamePattern('Pushups'), '%push%up%');
  assert.equal(exerciseNamePattern(''), '');

  const matches = (pattern: string, candidate: string) =>
    new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i').test(candidate);
  const pattern = exerciseNamePattern('Decline Push-Ups');
  assert.ok(matches(pattern, 'Decline Push Up'));
  assert.ok(matches(pattern, 'Decline Pushups'));
  assert.ok(matches(pattern, 'Decline Push-Up'));
  // Over-broad on purpose: namesMatchExercise is what rejects the near misses.
  assert.ok(matches(pattern, 'Decline Push Up Plank'));
  assert.ok(!namesMatchExercise('Decline Push-Ups', 'Decline Push Up Plank'));
});

test('equipment shorthand, a one-arm dumbbell qualifier and trailing cues are the same lift', () => {
  const history = [
    'DB Rows',
    'Dumbbell Row',
    'One-Arm Dumbbell Row',
    'One-arm dumbbell row, elbow close to body',
    'One-arm dumbbell row, supported on bench',
  ];
  for (const name of history) assert.equal(namesMatchExercise('One-Arm DB Rows', name), true, name);
  assert.equal(namesMatchExercise('BB Curl', 'Barbell Curls'), true);
  assert.equal(namesMatchExercise('KB Swing', 'Kettlebell Swings'), true);
});

test('shorthand does not merge different lifts', () => {
  assert.equal(namesMatchExercise('One-Arm DB Rows', 'Chest-supported dumbbell row, bench inclined'), false);
  assert.equal(namesMatchExercise('One-Arm DB Rows', 'DB Split Squat Row'), false);
  assert.equal(namesMatchExercise('One-Arm DB Rows', 'Barbell Row'), false);
  assert.equal(namesMatchExercise('Single-Arm Cable Row', 'Cable Row'), false);
});

test('the catalog search reaches both the spelled-out and the shorthand rows', () => {
  assert.deepEqual(exerciseNamePatterns('One-Arm DB Rows'), ['%dumbbell%row%', '%db%row%']);
  assert.deepEqual(exerciseNamePatterns('Pull Ups'), ['%pull%up%']);
});

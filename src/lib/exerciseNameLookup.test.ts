import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exerciseCanonicalKey,
  exerciseCompactKey,
  exerciseNameKey,
  exerciseNameLookupCandidates,
  exerciseNamePattern,
  exerciseSlugFromName,
  namesMatchExercise,
} from './exerciseNameLookup';

test('Pull-Up is the same lift as the catalog Pull Up', () => {
  assert.equal(exerciseNameKey('Pull-Up'), 'pull up');
  assert.equal(exerciseNameKey('Pull Up'), 'pull up');
  assert.equal(namesMatchExercise('Pull-Up', 'Pull Up'), true);
  assert.equal(exerciseSlugFromName('Pull-Up'), 'pull-up');
  assert.equal(exerciseSlugFromName('Pull Up'), 'pull-up');
});

test('other hyphenated PDF names resolve to spaced catalog names', () => {
  assert.ok(namesMatchExercise('Chin-Up', 'Chin Up'));
  assert.ok(namesMatchExercise('Step-Up', 'Step Up'));
  assert.ok(namesMatchExercise('Close-Grip Bench Press', 'Close Grip Bench Press'));
  assert.ok(namesMatchExercise('One-Arm Dumbbell Row', 'One Arm Dumbbell Row'));
  assert.equal(namesMatchExercise('Pull-Up', 'Barbell Row'), false);
});

test('plural and alternate spellings match the singular catalog lift', () => {
  // This is the exact regression: a plan listing "Pull Ups" opened the session on Barbell Row.
  assert.ok(namesMatchExercise('Pull Ups', 'Pull Up'));
  assert.ok(namesMatchExercise('Pull-Ups', 'Pull Up'));
  assert.ok(namesMatchExercise('Pullups', 'Pull Up'));
  assert.ok(namesMatchExercise('Barbell Rows', 'Barbell Row'));
  assert.ok(namesMatchExercise('Lateral Raises', 'Lateral Raise'));
  assert.ok(namesMatchExercise('Bicep Curls', 'Bicep Curl'));
  assert.ok(namesMatchExercise('Triceps Pushdowns', 'Triceps Pushdown'));
  assert.ok(namesMatchExercise('Lunges', 'Lunge'));
  assert.ok(namesMatchExercise('Crunches', 'Crunch'));
  // Bench Press must not be singularized to "Bench Pres".
  assert.ok(namesMatchExercise('Bench Presses', 'Bench Press'));
  assert.ok(namesMatchExercise('Bench Press', 'Bench Press'));
});

test('canonical key does not over-collapse distinct lifts', () => {
  assert.notEqual(exerciseCanonicalKey('Pull Up'), exerciseCanonicalKey('Barbell Row'));
  assert.notEqual(exerciseCanonicalKey('Bench Press'), exerciseCanonicalKey('Overhead Press'));
  assert.equal(exerciseCanonicalKey('Pull Ups'), 'pull up');
  assert.equal(exerciseCanonicalKey('Barbell Rows'), 'barbell row');
});

test('the duplicate catalog rows that split a lift history are one lift', () => {
  // These pairs are really in the catalog, a seeded row beside a custom row the app minted
  // when exact-name matching missed. History hangs off exercise_id, so the weight logged
  // against one is invisible to the other.
  assert.ok(namesMatchExercise('Decline push-ups', 'Decline Push-Up'));
  assert.ok(namesMatchExercise('Step-Ups', 'Step-Up'));
  assert.ok(namesMatchExercise('Weighted Situps', 'Weighted Sit-Up'));
  // ...without dragging in the near neighbours the loose pattern also returns.
  assert.ok(!namesMatchExercise('Step-Ups', 'Poliquin Step-Up'));
  assert.ok(!namesMatchExercise('Decline push-ups', 'Diamond Push-Up'));
  assert.ok(!namesMatchExercise('Decline push-ups', 'Decline Bench Press'));
});

test('a compound inside a longer name collapses onto the catalog spelling', () => {
  assert.equal(exerciseCanonicalKey('Decline Push-Ups'), 'decline push up');
  assert.equal(exerciseCanonicalKey('Decline Pushups'), 'decline push up');
  assert.equal(exerciseCanonicalKey('Decline Push Up'), 'decline push up');
  assert.ok(namesMatchExercise('Decline Push-Ups', 'Decline Pushups'));
  assert.ok(namesMatchExercise('Incline Pushups', 'Incline Push-Up'));
  assert.ok(namesMatchExercise('Wide Grip Pull-Ups', 'Wide Grip Pullups'));
  assert.ok(!namesMatchExercise('Decline Push-Ups', 'Incline Push-Ups'));
});

test('lifts split into different words still match', () => {
  assert.ok(namesMatchExercise('Lat Pulldown', 'Lat Pull Down'));
  assert.ok(namesMatchExercise('Deadlift', 'Dead Lift'));
  assert.ok(namesMatchExercise('Triceps Pushdowns', 'Triceps Push Down'));
  assert.equal(exerciseCompactKey('Bench Presses'), 'benchpress');
  assert.equal(exerciseCompactKey('Bench Press'), 'benchpress');
  assert.ok(!namesMatchExercise('Lat Pulldown', 'Leg Press'));
  assert.ok(!namesMatchExercise('Deadlift', 'Romanian Deadlift'));
});

test('the lookup pattern reaches every spelling of a lift', () => {
  assert.equal(exerciseNamePattern('Decline Push-Ups'), '%decline%push%up%');
  assert.equal(exerciseNamePattern('Pushups'), '%push%up%');
  assert.equal(exerciseNamePattern(''), '');

  // The pattern is over-broad by design; namesMatchExercise is what rejects the near misses.
  const matches = (pattern: string, candidate: string) =>
    new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i').test(candidate);
  const pattern = exerciseNamePattern('Decline Push-Ups');
  assert.ok(matches(pattern, 'Decline Push Up'));
  assert.ok(matches(pattern, 'Decline Pushups'));
  assert.ok(matches(pattern, 'Decline Push-Up'));
  assert.ok(matches(pattern, 'Decline Push Up Plank'));
  assert.ok(!namesMatchExercise('Decline Push-Ups', 'Decline Push Up Plank'));
});

test('lookup candidates try the hyphenated name then the spaced catalog spelling', () => {
  assert.deepEqual(exerciseNameLookupCandidates('Pull-Up'), ['Pull-Up', 'Pull Up']);
  assert.deepEqual(exerciseNameLookupCandidates('Barbell Row'), ['Barbell Row']);
});

test('lookup candidates add the singular spelling for plural plan names', () => {
  const hasPullUp = (candidates: string[]) =>
    candidates.some((candidate) => candidate.toLowerCase() === 'pull up');
  const pullUps = exerciseNameLookupCandidates('Pull Ups');
  assert.ok(hasPullUp(pullUps), `expected Pull Up in ${JSON.stringify(pullUps)}`);
  const hyphenPlural = exerciseNameLookupCandidates('Pull-Ups');
  assert.ok(hasPullUp(hyphenPlural), `expected Pull Up in ${JSON.stringify(hyphenPlural)}`);
  const compound = exerciseNameLookupCandidates('Pullups');
  assert.ok(hasPullUp(compound), `expected Pull Up in ${JSON.stringify(compound)}`);
});

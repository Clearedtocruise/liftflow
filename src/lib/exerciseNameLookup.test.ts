import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exerciseCanonicalKey,
  exerciseNameKey,
  exerciseNameLookupCandidates,
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

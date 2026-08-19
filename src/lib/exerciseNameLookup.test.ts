import assert from 'node:assert/strict';
import test from 'node:test';

import {
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

test('lookup candidates try the hyphenated name then the spaced catalog spelling', () => {
  assert.deepEqual(exerciseNameLookupCandidates('Pull-Up'), ['Pull-Up', 'Pull Up']);
  assert.deepEqual(exerciseNameLookupCandidates('Barbell Row'), ['Barbell Row']);
});

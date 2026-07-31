import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSameExerciseName,
  MAX_CUSTOM_EXERCISE_NAME,
  normalizeCustomExerciseName,
  shouldOfferCustomExercise,
  validateCustomExerciseName,
} from './customExerciseName';

test('spacing and case cannot create a duplicate exercise', () => {
  assert.equal(normalizeCustomExerciseName('  Hack   Squat '), 'Hack Squat');
  assert.equal(isSameExerciseName('hack squat', 'Hack  Squat'), true);
  assert.equal(isSameExerciseName('Hack Squat', 'Front Squat'), false);
});

test('a usable name is accepted', () => {
  const check = validateCustomExerciseName('  Reverse Hyper ');
  assert.ok(check.valid);
  assert.equal(check.name, 'Reverse Hyper');
});

test('an empty or one-character name is refused with a reason', () => {
  const empty = validateCustomExerciseName('   ');
  assert.equal(empty.valid, false);
  assert.match((empty as { reason: string }).reason, /name/i);

  assert.equal(validateCustomExerciseName('x').valid, false);
});

test('a stray weight typed into the search box is not an exercise', () => {
  assert.equal(validateCustomExerciseName('225').valid, false);
  assert.equal(validateCustomExerciseName('12 10').valid, false);
});

test('long names are truncated rather than rejected', () => {
  const long = 'a'.repeat(120);
  assert.equal(normalizeCustomExerciseName(long).length, MAX_CUSTOM_EXERCISE_NAME);
  assert.equal(validateCustomExerciseName(long).valid, true);
});

test('create is offered when the catalog has no such exercise', () => {
  assert.equal(shouldOfferCustomExercise('Reverse Hyper', []), true);
  assert.equal(
    shouldOfferCustomExercise('Reverse Hyper', [{ name: 'Reverse Lunge' }, { name: 'Hyperextension' }]),
    true,
  );
});

test('create is hidden when the exercise already exists', () => {
  assert.equal(shouldOfferCustomExercise('Bench Press', [{ name: 'Bench Press' }]), false);
  // Same exercise typed differently must not invite a duplicate row.
  assert.equal(shouldOfferCustomExercise('  bench   press ', [{ name: 'Bench Press' }]), false);
});

test('create is hidden for an unusable query', () => {
  assert.equal(shouldOfferCustomExercise('', []), false);
  assert.equal(shouldOfferCustomExercise('   ', []), false);
  assert.equal(shouldOfferCustomExercise('225', []), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { matchSpokenExercise } from './matchSpokenExercise';

test('the same exercise spoken plainly is an exact match', () => {
  assert.equal(matchSpokenExercise('bench press', 'Barbell Bench Press').kind, 'exact');
  assert.equal(matchSpokenExercise('pull ups', 'Pull-Up').kind, 'exact');
});

test('a different movement is rejected', () => {
  assert.equal(matchSpokenExercise('bench press', 'Barbell Row').kind, 'different');
});

test('an incline/decline qualifier conflict is rejected even though the movement matches', () => {
  const result = matchSpokenExercise('incline bench press', 'Decline Bench Press');
  assert.equal(result.kind, 'different');
});

test('naming a different implement for the same movement is rejected — the reported bug', () => {
  // "Barbell Rows" spoken while "Dumbbell Row" is the active exercise used to reduce to the same
  // core token ("row") and get accepted as an exact match, so the set landed on the wrong
  // exercise. Explicit, conflicting implements must now be treated as different exercises.
  assert.equal(matchSpokenExercise('barbell rows', 'Dumbbell Row').kind, 'different');
  assert.equal(matchSpokenExercise('dumbbell rows', 'Barbell Row').kind, 'different');
  assert.equal(matchSpokenExercise('bb row', 'Dumbbell Row').kind, 'different');
  assert.equal(matchSpokenExercise('db row', 'Barbell Row').kind, 'different');
  assert.equal(matchSpokenExercise('cable row', 'Barbell Row').kind, 'different');
});

test('matching implements for the same movement still match', () => {
  assert.equal(matchSpokenExercise('barbell rows', 'Barbell Row').kind, 'exact');
  assert.equal(matchSpokenExercise('bar row', 'Barbell Row').kind, 'exact');
  assert.equal(matchSpokenExercise('dumbbell rows', 'Dumbbell Row').kind, 'exact');
});

test('an unqualified spoken name still matches whatever implement is active', () => {
  // Saying just "rows" (no implement named) should not be rejected against any row variant — the
  // active exercise is the only candidate voice logging ever writes to.
  assert.equal(matchSpokenExercise('rows', 'Barbell Row').kind, 'exact');
  assert.equal(matchSpokenExercise('rows', 'Dumbbell Row').kind, 'exact');
  assert.equal(matchSpokenExercise('rows', 'Seated Cable Row').kind, 'related');
});

test('an implement named only on the active side still matches an unqualified spoken name', () => {
  assert.equal(matchSpokenExercise('curls', 'Dumbbell Curl').kind, 'exact');
  assert.equal(matchSpokenExercise('kickback', 'DB Kickback').kind, 'exact');
});

test('empty or unintelligible speech never matches', () => {
  assert.equal(matchSpokenExercise('', 'Barbell Row').kind, 'different');
  assert.equal(matchSpokenExercise('   ', 'Barbell Row').kind, 'different');
});

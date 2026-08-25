import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addExercise,
  createEmptyDraft,
  cycleToDraft,
  draftToCycleInput,
  isDraftValid,
  moveExercise,
  removeExercise,
  replaceExercise,
  setCycleLength,
  toggleRestDay,
  updateExerciseField,
  type DraftExercise,
} from './programCycleEditor';

function draftEx(name: string, sets = 3, reps = '8-10'): DraftExercise {
  return { name, sets, reps };
}

test('createEmptyDraft builds N workout days clamped to 1..30', () => {
  assert.equal(createEmptyDraft(5).length, 5);
  assert.equal(createEmptyDraft(0).length, 1);
  assert.equal(createEmptyDraft(99).length, 30);
});

test('setCycleLength grows and shrinks while preserving days', () => {
  let days = createEmptyDraft(3);
  days = addExercise(days, 0, draftEx('Bench Press'));
  const grown = setCycleLength(days, 7);
  assert.equal(grown.length, 7);
  assert.equal(grown[0]?.exercises[0]?.name, 'Bench Press');
  const shrunk = setCycleLength(grown, 2);
  assert.equal(shrunk.length, 2);
  assert.equal(shrunk[0]?.exercises[0]?.name, 'Bench Press');
});

test('toggleRestDay clears exercises and can flip back', () => {
  let days = createEmptyDraft(2);
  days = addExercise(days, 1, draftEx('Row'));
  days = toggleRestDay(days, 1);
  assert.equal(days[1]?.isRest, true);
  assert.deepEqual(days[1]?.exercises, []);
  days = toggleRestDay(days, 1);
  assert.equal(days[1]?.isRest, false);
});

test('add / remove / replace exercises on a workout day', () => {
  let days = createEmptyDraft(1);
  days = addExercise(days, 0, draftEx('Squat'));
  days = addExercise(days, 0, draftEx('Leg Press'));
  assert.equal(days[0]?.exercises.length, 2);
  days = removeExercise(days, 0, 0);
  assert.equal(days[0]?.exercises[0]?.name, 'Leg Press');
  days = replaceExercise(days, 0, 0, { name: 'Hack Squat' });
  assert.equal(days[0]?.exercises[0]?.name, 'Hack Squat');
});

test('reorder exercises within a day', () => {
  let days = createEmptyDraft(1);
  days = addExercise(days, 0, draftEx('A'));
  days = addExercise(days, 0, draftEx('B'));
  days = addExercise(days, 0, draftEx('C'));
  days = moveExercise(days, 0, 2, 0); // move C to front
  assert.deepEqual(days[0]?.exercises.map((e) => e.name), ['C', 'A', 'B']);
  days = moveExercise(days, 0, 0, 1); // swap C and A
  assert.deepEqual(days[0]?.exercises.map((e) => e.name), ['A', 'C', 'B']);
});

test('edit set/rep/weight targets', () => {
  let days = createEmptyDraft(1);
  days = addExercise(days, 0, draftEx('Bench Press'));
  days = updateExerciseField(days, 0, 0, { sets: 5, reps: '5', weightLbs: 185 });
  assert.equal(days[0]?.exercises[0]?.sets, 5);
  assert.equal(days[0]?.exercises[0]?.reps, '5');
  assert.equal(days[0]?.exercises[0]?.weightLbs, 185);
});

test('draftToCycleInput produces a valid API payload with rest days emptied', () => {
  let days = createEmptyDraft(3);
  days = addExercise(days, 0, draftEx('Bench Press', 5, '5'));
  days = toggleRestDay(days, 1);
  days = addExercise(days, 2, draftEx('Deadlift', 3, '5'));
  const input = draftToCycleInput('My Split', days);
  assert.equal(input.name, 'My Split');
  assert.equal(input.lengthDays, 3);
  assert.equal(input.days[0]?.exercises?.[0]?.name, 'Bench Press');
  assert.equal(input.days[1]?.isRest, true);
  assert.deepEqual(input.days[1]?.exercises, []);
});

test('round-trips an existing cycle back into an editable draft', () => {
  const draft = cycleToDraft([
    { label: 'Push', isRest: false, exercises: [{ name: 'Bench Press', exerciseName: 'Bench Press', sets: 5, repRange: '5' }] },
    { label: 'Rest', isRest: true, exercises: [] },
  ]);
  assert.equal(draft.length, 2);
  assert.equal(draft[0]?.exercises[0]?.name, 'Bench Press');
  assert.equal(draft[0]?.exercises[0]?.sets, 5);
  assert.equal(draft[1]?.isRest, true);
});

test('validation requires at least one exercise on a workout day', () => {
  assert.equal(isDraftValid(createEmptyDraft(5)).valid, false);
  const withWork = addExercise(createEmptyDraft(1), 0, draftEx('Squat'));
  assert.equal(isDraftValid(withWork).valid, true);
});

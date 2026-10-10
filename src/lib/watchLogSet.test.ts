import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFirstNumber, resolveWatchActiveExercise, resolveWatchSetPayload } from './watchLogSet';
import type { WorkoutSession } from '@/types';

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Push Day',
    status: 'active',
    startedAt: '2026-07-31T10:00:00Z',
    exercises: [
      {
        id: 'we-1',
        sortOrder: 0,
        exerciseId: 'bench',
        exercise: { id: 'bench', name: 'Bench Press' },
        suggestedReps: '8-10',
        suggestedWeight: 60,
        sets: [],
      },
      {
        id: 'we-2',
        sortOrder: 1,
        exerciseId: 'row',
        exercise: { id: 'row', name: 'Barbell Row' },
        suggestedReps: '10',
        sets: [],
      },
    ],
    ...overrides,
  } as unknown as WorkoutSession;
}

test('logs against the exercise the watch is showing', () => {
  const result = resolveWatchSetPayload({
    session: session(),
    activeExerciseIndex: 1,
    draftWeightKg: 50,
  });
  assert.ok(result.ok);
  assert.equal(result.payload.workoutExerciseId, 'we-2');
  assert.equal(result.exerciseName, 'Barbell Row');
});

test('dictated reps and weight win', () => {
  const result = resolveWatchSetPayload({
    session: session(),
    activeExerciseIndex: 0,
    draftReps: 12,
    draftWeightKg: 72.5,
  });
  assert.ok(result.ok);
  assert.equal(result.payload.reps, 12);
  assert.equal(result.payload.weight, 72.5);
});

test('without dictation it repeats the last set on that exercise', () => {
  const withHistory = session();
  withHistory.exercises[0].sets = [
    { id: 'set-1', reps: 10, weight: 60 },
    { id: 'set-2', reps: 9, weight: 65 },
  ] as never;

  const result = resolveWatchSetPayload({ session: withHistory, activeExerciseIndex: 0 });
  assert.ok(result.ok);
  assert.equal(result.payload.reps, 9);
  assert.equal(result.payload.weight, 65);
});

test('a first set falls back to the plan', () => {
  const result = resolveWatchSetPayload({ session: session(), activeExerciseIndex: 0 });
  assert.ok(result.ok);
  assert.equal(result.payload.reps, 8);
  assert.equal(result.payload.weight, 60);
});

test('strength work without a known weight is refused', () => {
  const result = resolveWatchSetPayload({ session: session(), activeExerciseIndex: 1 });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /Set a weight/);
});

test('bodyweight work logs at zero rather than refusing', () => {
  const pullUps = session();
  pullUps.exercises[1] = {
    id: 'we-2',
    sortOrder: 1,
    exerciseId: 'pullup',
    exercise: { id: 'pullup', name: 'Pull-Up' },
    suggestedReps: '10',
    sets: [],
  } as never;

  const result = resolveWatchSetPayload({ session: pullUps, activeExerciseIndex: 1 });
  assert.ok(result.ok);
  assert.equal(result.payload.weight, 0);
  assert.equal(result.payload.reps, 10);
});

test('a paused or finished workout refuses with a reason', () => {
  const paused = resolveWatchSetPayload({
    session: session({ status: 'paused' }),
    activeExerciseIndex: 0,
  });
  assert.equal(paused.ok, false);
  assert.match((paused as { error: string }).error, /Resume/);

  const done = resolveWatchSetPayload({
    session: session({ status: 'completed' }),
    activeExerciseIndex: 0,
  });
  assert.equal(done.ok, false);
});

test('no session tells the user to start one', () => {
  const result = resolveWatchSetPayload({ session: null, activeExerciseIndex: 0 });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /Start a workout/);
});

test('an out-of-range index lands on the last exercise, which is the one the watch is showing', () => {
  // The phone clamps the index when it builds the watch face. This path used to fall back to
  // sorted[0] instead, so the wrist read "Barbell Row" and the set was written under Bench Press.
  const result = resolveWatchSetPayload({
    session: session(),
    activeExerciseIndex: 99,
    draftWeightKg: 50,
  });
  assert.ok(result.ok);
  assert.equal(result.payload.workoutExerciseId, 'we-2');
  assert.equal(result.exerciseName, 'Barbell Row');
});

test('the exercise named on the watch face wins over the index', () => {
  const result = resolveWatchSetPayload({
    session: session(),
    activeExerciseIndex: 0,
    displayedWorkoutExerciseId: 'we-2',
    draftWeightKg: 50,
  });
  assert.ok(result.ok);
  assert.equal(result.payload.workoutExerciseId, 'we-2');
});

test('a displayed exercise that is no longer in the workout gives way to the index', () => {
  // Swapped or deleted from the phone before the wrist tap arrived.
  const result = resolveWatchSetPayload({
    session: session(),
    activeExerciseIndex: 0,
    displayedWorkoutExerciseId: 'we-deleted',
  });
  assert.ok(result.ok);
  assert.equal(result.payload.workoutExerciseId, 'we-1');
});

test('an index outside the workout is clamped, never wrapped to the start', () => {
  const sorted = [{ id: 'we-1' }, { id: 'we-2' }, { id: 'we-3' }];
  const at = (activeExerciseIndex: number) =>
    resolveWatchActiveExercise(sorted, { activeExerciseIndex })?.id;

  assert.equal(at(-1), 'we-1');
  assert.equal(at(0), 'we-1');
  assert.equal(at(2), 'we-3');
  assert.equal(at(7), 'we-3');
  assert.equal(resolveWatchActiveExercise([], { activeExerciseIndex: 0 }), undefined);
});

test('an exercise flagged active outranks the index, as it does on the watch face', () => {
  const sorted = [{ id: 'we-1' }, { id: 'we-2', isActive: true }, { id: 'we-3' }];
  assert.equal(resolveWatchActiveExercise(sorted, { activeExerciseIndex: 0 })?.id, 'we-2');
  // Unless the face is already naming one, in which case that is what the lifter is looking at.
  assert.equal(
    resolveWatchActiveExercise(sorted, { activeExerciseIndex: 0, displayedWorkoutExerciseId: 'we-3' })?.id,
    'we-3',
  );
});

test('logging past the plan target is refused', () => {
  const full = session();
  full.exercises[0].sets = [
    { id: 'a', reps: 10, weight: 60 },
    { id: 'b', reps: 10, weight: 60 },
    { id: 'c', reps: 10, weight: 60 },
  ] as never;

  const result = resolveWatchSetPayload({
    session: full,
    activeExerciseIndex: 0,
    targetSets: 3,
  });
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /already logged/);
});

test('rep ranges parse to their lower bound', () => {
  assert.equal(parseFirstNumber('8-10'), 8);
  assert.equal(parseFirstNumber('12'), 12);
  assert.equal(parseFirstNumber(undefined), undefined);
  assert.equal(parseFirstNumber('AMRAP'), undefined);
});

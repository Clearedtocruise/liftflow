/**
 * Reading back what you have done on one lift.
 *
 * Sets live one row at a time under whichever workout_exercise row held them that day, so the
 * question "what have I been doing on bench?" is only answerable once those rows are gathered
 * into the sessions they were performed in.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExerciseHistory,
  pickTopSet,
  summarizeExerciseHistory,
  type ExerciseHistorySetRow,
  type ExerciseSessionRow,
} from './exerciseHistory';

const session = (overrides: Partial<ExerciseSessionRow> & { workoutExerciseId: string }): ExerciseSessionRow => ({
  sessionId: 'session-1',
  sessionName: 'Push Day',
  performedAt: '2026-09-20T17:00:00Z',
  ...overrides,
});

const set = (overrides: Partial<ExerciseHistorySetRow> & { workoutExerciseId: string }): ExerciseHistorySetRow => ({
  setNumber: 1,
  weightKg: 100,
  reps: 5,
  loggedAt: '2026-09-20T17:05:00Z',
  ...overrides,
});

test('sets are gathered into the session they were performed in', () => {
  const history = buildExerciseHistory(
    [
      set({ workoutExerciseId: 'we-1', setNumber: 1, loggedAt: '2026-09-20T17:05:00Z' }),
      set({ workoutExerciseId: 'we-1', setNumber: 2, loggedAt: '2026-09-20T17:08:00Z' }),
    ],
    [session({ workoutExerciseId: 'we-1' })],
  );

  assert.equal(history.length, 1);
  assert.equal(history[0].sets.length, 2);
  assert.equal(history[0].sessionName, 'Push Day');
});

test('the same lift trained twice in one session is still one session', () => {
  // Adding an exercise that is already in the workout creates a second row for the same day.
  const history = buildExerciseHistory(
    [
      set({ workoutExerciseId: 'we-1', setNumber: 1, loggedAt: '2026-09-20T17:05:00Z' }),
      set({ workoutExerciseId: 'we-2', setNumber: 1, loggedAt: '2026-09-20T17:40:00Z', weightKg: 90 }),
    ],
    [session({ workoutExerciseId: 'we-1' }), session({ workoutExerciseId: 'we-2' })],
  );

  assert.equal(history.length, 1);
  assert.equal(history[0].sets.length, 2);
});

test('sessions read newest first, and sets within a session in the order they were done', () => {
  const history = buildExerciseHistory(
    [
      set({ workoutExerciseId: 'older', loggedAt: '2026-09-06T17:05:00Z' }),
      set({ workoutExerciseId: 'newer', setNumber: 2, loggedAt: '2026-09-13T17:09:00Z' }),
      set({ workoutExerciseId: 'newer', setNumber: 1, loggedAt: '2026-09-13T17:05:00Z' }),
    ],
    [
      session({ workoutExerciseId: 'older', sessionId: 's-old', performedAt: '2026-09-06T17:00:00Z' }),
      session({ workoutExerciseId: 'newer', sessionId: 's-new', performedAt: '2026-09-13T17:00:00Z' }),
    ],
  );

  assert.deepEqual(
    history.map((entry) => entry.sessionId),
    ['s-new', 's-old'],
  );
  assert.deepEqual(history[0].sets.map((entry) => entry.setNumber), [1, 2]);
});

test('a session reports its volume, its top set and whether a PR fell', () => {
  const history = buildExerciseHistory(
    [
      set({ workoutExerciseId: 'we-1', setNumber: 1, weightKg: 100, reps: 5 }),
      set({ workoutExerciseId: 'we-1', setNumber: 2, weightKg: 100, reps: 8, isPr: true, loggedAt: '2026-09-20T17:09:00Z' }),
    ],
    [session({ workoutExerciseId: 'we-1' })],
  );

  assert.equal(history[0].volumeKg, 100 * 5 + 100 * 8);
  assert.equal(history[0].topSet?.reps, 8, 'reps break a tie between sets at the same load');
  assert.equal(history[0].hasPr, true);
});

test('work carrying no load still reports a top set', () => {
  // A plank has no weight to rank by, and reporting nothing would read as having done nothing.
  const holds = [
    set({ workoutExerciseId: 'we-1', setNumber: 1, weightKg: undefined, reps: undefined, durationSeconds: 45 }),
    set({ workoutExerciseId: 'we-1', setNumber: 2, weightKg: undefined, reps: undefined, durationSeconds: 70, loggedAt: '2026-09-20T17:09:00Z' }),
  ];
  const history = buildExerciseHistory(holds, [session({ workoutExerciseId: 'we-1' })]);

  assert.equal(history[0].topSet?.durationSeconds, 70);
  assert.equal(history[0].volumeKg, 0);
});

test('a set whose exercise row is unknown is dropped rather than shown under a blank day', () => {
  const history = buildExerciseHistory([set({ workoutExerciseId: 'orphan' })], []);
  assert.deepEqual(history, []);
});

test('the summary answers the heaviest, the most recent and how often', () => {
  const history = buildExerciseHistory(
    [
      set({ workoutExerciseId: 'we-1', weightKg: 100, reps: 5 }),
      set({ workoutExerciseId: 'we-2', weightKg: 110, reps: 3, loggedAt: '2026-09-13T17:05:00Z' }),
    ],
    [
      session({ workoutExerciseId: 'we-1', sessionId: 's-new', performedAt: '2026-09-20T17:00:00Z' }),
      session({ workoutExerciseId: 'we-2', sessionId: 's-old', performedAt: '2026-09-13T17:00:00Z' }),
    ],
  );
  const summary = summarizeExerciseHistory(history);

  assert.equal(summary.sessionCount, 2);
  assert.equal(summary.setCount, 2);
  assert.equal(summary.bestSet?.weightKg, 110);
  assert.equal(summary.lastPerformedAt, '2026-09-20T17:00:00Z');
  assert.equal(summary.bestVolumeKg, 500);
});

test('nothing logged yet summarises as nothing, not as a zero best', () => {
  const summary = summarizeExerciseHistory([]);
  assert.equal(summary.bestSet, null);
  assert.equal(summary.lastPerformedAt, null);
  assert.equal(summary.sessionCount, 0);
});

test('pickTopSet prefers load over reps', () => {
  const top = pickTopSet([
    { setNumber: 1, weightKg: 80, reps: 12, loggedAt: '2026-09-20T17:05:00Z' },
    { setNumber: 2, weightKg: 100, reps: 3, loggedAt: '2026-09-20T17:09:00Z' },
  ]);
  assert.equal(top?.weightKg, 100);
});

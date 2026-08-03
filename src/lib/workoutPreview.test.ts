import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkoutPreview, describePlannedExercise, summarizeWorkoutPreview } from './workoutPreview';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

function exercise(partial: Partial<EditableWorkoutExercise> & { name: string }): EditableWorkoutExercise {
  return { id: partial.name.toLowerCase(), sets: 3, ...partial };
}

test('a strength exercise reads as sets, reps and rest', () => {
  const detail = describePlannedExercise(
    exercise({ name: 'Bench Press', sets: 4, repRange: '8-10', restSeconds: 90 }),
  );
  assert.equal(detail, '4 sets × 8-10 · 90s rest');
});

test('rest over a minute is written in minutes', () => {
  const detail = describePlannedExercise(
    exercise({ name: 'Squat', sets: 5, repRange: '5', restSeconds: 180 }),
  );
  assert.equal(detail, '5 sets × 5 · 3m rest');
  assert.match(describePlannedExercise(exercise({ name: 'Deadlift', restSeconds: 150 })), /2m 30s rest/);
});

test('a target weight is included when the plan has one', () => {
  const detail = describePlannedExercise(
    exercise({ name: 'Row', sets: 3, repRange: '10', restSeconds: 60, weightLbs: 135 }),
  );
  assert.equal(detail, '3 sets × 10 · 60s rest · 135 lb');
});

test('interval work is described in rounds, never sets', () => {
  // Reporting Tabata as "8 sets" is the same confusion that made the app auto-advance early.
  const detail = describePlannedExercise(
    exercise({
      name: 'Kettlebell Swing',
      executionMode: 'tabata',
      intervalRounds: 8,
      intervalWorkSeconds: 20,
      intervalRestSeconds: 10,
      sets: 1,
    }),
  );
  assert.equal(detail, '8 rounds · 20s work / 10s rest');
  assert.doesNotMatch(detail, /set/);
});

test('a single set is not pluralised', () => {
  assert.match(describePlannedExercise(exercise({ name: 'Plank', sets: 1 })), /^1 set$/);
});

test('paired exercises use standard A1 / A2 station notation', () => {
  // A bare "A." glued to the front of the name read like an outline heading rather than a
  // programme. Stations are numbered within their group, as on the workout and session screens.
  const preview = buildWorkoutPreview([
    exercise({ name: 'Bench Press', id: 'a', supersetGroupId: 'g1' }),
    exercise({ name: 'Barbell Row', id: 'b', supersetGroupId: 'g1' }),
    exercise({ name: 'Curl', id: 'c' }),
    exercise({ name: 'Leg Press', id: 'd', supersetGroupId: 'g2' }),
    exercise({ name: 'Leg Curl', id: 'e', supersetGroupId: 'g2' }),
  ]);

  assert.equal(preview.rows[0]!.supersetLabel, 'A1');
  assert.equal(preview.rows[1]!.supersetLabel, 'A2');
  assert.equal(preview.rows[2]!.supersetLabel, undefined);
  assert.equal(preview.rows[3]!.supersetLabel, 'B1');
  assert.equal(preview.rows[4]!.supersetLabel, 'B2');
  assert.deepEqual(preview.rows.map((row) => row.position), [1, 2, 3, 4, 5]);

  // The name itself must stay clean — no letter is ever folded into it.
  for (const row of preview.rows) {
    assert.doesNotMatch(row.name, /^[A-Z]\d?\s*[.·]/);
  }
});

test('a group with only one exercise is not shown as a superset', () => {
  const preview = buildWorkoutPreview([exercise({ name: 'Bench Press', supersetGroupId: 'lonely' })]);
  assert.equal(preview.rows[0]!.supersetLabel, undefined);
});

test('the summary counts every exercise, not just the four the card showed', () => {
  const preview = buildWorkoutPreview([
    exercise({ name: 'A', sets: 4 }),
    exercise({ name: 'B', sets: 3 }),
    exercise({ name: 'C', sets: 3 }),
    exercise({ name: 'D', sets: 3 }),
    exercise({ name: 'E', sets: 2 }),
  ]);

  assert.equal(preview.exerciseCount, 5);
  assert.equal(preview.totalSets, 15);
  assert.equal(summarizeWorkoutPreview(preview), '5 exercises · 15 sets');
});

test('interval rounds count toward the session total', () => {
  const preview = buildWorkoutPreview([
    exercise({ name: 'Swing', executionMode: 'tabata', intervalRounds: 8, sets: 1 }),
    exercise({ name: 'Press', sets: 3 }),
  ]);
  assert.equal(preview.totalSets, 11);
});

test('an empty plan summarises without inventing sets', () => {
  const preview = buildWorkoutPreview([]);
  assert.equal(preview.rows.length, 0);
  assert.equal(summarizeWorkoutPreview(preview), '0 exercises');
});

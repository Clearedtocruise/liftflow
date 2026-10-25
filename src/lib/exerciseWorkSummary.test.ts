import assert from 'node:assert/strict';
import test from 'node:test';

import { formatWorkDuration, summarizeExerciseWork } from './exerciseWorkSummary';

const BW = 82.78;

test('a plank finishes with the time held, not 0 volume', () => {
  const sets = [1, 2, 3].map(() => ({ reps: 1, durationSeconds: 60 }));
  assert.deepEqual(summarizeExerciseWork('timed', sets, 'Plank', BW), { kind: 'time', seconds: 180, sets: 3 });
  assert.equal(formatWorkDuration(180), '3:00');
});

test('a timed HIIT round counts its seconds the same way', () => {
  const rounds = Array.from({ length: 8 }, () => ({ reps: 1, durationSeconds: 20 }));
  assert.equal(summarizeExerciseWork('timed', rounds, 'Mountain Climbers', BW).kind, 'time');
  assert.equal(formatWorkDuration(160), '2:40');
});

test('pull-ups and leg raises finish with reps and the body-weight share they moved', () => {
  const pullUps = summarizeExerciseWork('bodyweight', [{ reps: 8 }, { reps: 8 }, { reps: 8 }], 'Pull Up', BW);
  assert.equal(pullUps.kind, 'reps');
  if (pullUps.kind === 'reps') {
    assert.equal(pullUps.reps, 24);
    assert.ok(Math.abs(pullUps.volumeKg - 24 * 82.8) < 0.01);
  }
  const legRaises = summarizeExerciseWork('bodyweight', [{ reps: 8 }, { reps: 9 }, { reps: 8 }], 'Hanging Leg Raise', BW);
  if (legRaises.kind === 'reps') assert.equal(legRaises.reps, 25);
});

test('an ab move with no known share still reports its reps instead of nothing', () => {
  const work = summarizeExerciseWork('bodyweight', [{ reps: 15 }, { reps: 15 }], 'Bird Dog', BW);
  assert.deepEqual(work, { kind: 'reps', reps: 30, volumeKg: 0, sets: 2 });
});

test('a loaded lift is still load × reps', () => {
  const work = summarizeExerciseWork('weighted', [{ weight: 70.31, reps: 8 }, { weight: 70.31, reps: 8 }], 'Barbell Row', BW);
  assert.equal(work.kind, 'volume');
  if (work.kind === 'volume') assert.ok(Math.abs(work.volumeKg - 1124.96) < 0.01);
});

test('cardio reports time and distance', () => {
  assert.deepEqual(summarizeExerciseWork('cardio', [{ reps: 1, durationSeconds: 600, distanceMeters: 2000 }], 'Row Erg', BW), {
    kind: 'cardio',
    seconds: 600,
    meters: 2000,
    sets: 1,
  });
});

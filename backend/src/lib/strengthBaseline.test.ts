import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateOneRepMaxLbs,
  estimatedMaxForLift,
  isPlausibleBaseline,
  sanitizeBaselines,
  seedWeightLbsFromBaselines,
  workingWeightLbs,
  type StrengthBaselines,
} from './strengthBaseline.js';

const LIFTER: StrengthBaselines = {
  bench_press: { weightLbs: 185, reps: 5 },
  squat: { weightLbs: 275, reps: 5 },
  deadlift: { weightLbs: 315, reps: 5 },
};

test('a reported set becomes an estimated max', () => {
  assert.equal(estimateOneRepMaxLbs(185, 5), 215.8);
  assert.equal(estimateOneRepMaxLbs(225, 1), 225);
  assert.equal(estimateOneRepMaxLbs(0, 5), 0);
  assert.equal(estimateOneRepMaxLbs(185, 0), 0);
});

test('a very high rep count does not inflate the estimate', () => {
  // Epley drifts badly past about 12 reps; "135 for 30" must not imply a 270 lb max.
  const at12 = estimateOneRepMaxLbs(135, 12);
  assert.equal(estimateOneRepMaxLbs(135, 30), at12);
  assert.ok(at12 < 200);
});

test('working weight and estimated max are inverses', () => {
  const max = estimateOneRepMaxLbs(185, 5);
  assert.ok(Math.abs(workingWeightLbs(max, 5) - 185) < 0.5);
});

test('a starting load comes from the lift the movement is anchored to', () => {
  // Bench 185x5 is a ~216 lb max, so a bench-anchored press for 8 reps lands near 160.
  const bench = seedWeightLbsFromBaselines({
    exerciseName: 'Barbell Bench Press',
    baselines: LIFTER,
    targetReps: 8,
  });
  assert.ok(bench && bench >= 140 && bench <= 175, `expected a plausible bench start, got ${bench}`);

  const squat = seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: LIFTER, targetReps: 8 });
  assert.ok(squat && squat > bench!, 'this lifter squats more than they bench');

  // Accessory work must come back far lighter than the compound it hangs off.
  const curl = seedWeightLbsFromBaselines({ exerciseName: 'Dumbbell Curl', baselines: LIFTER, targetReps: 10 });
  assert.ok(curl && curl < bench! / 2, `a curl should be far lighter than a bench, got ${curl}`);

  const kickback = seedWeightLbsFromBaselines({ exerciseName: 'DB Kickback', baselines: LIFTER, targetReps: 12 });
  assert.ok(kickback && kickback <= 45, `a kickback must stay light, got ${kickback}`);
});

test('variants of a lift are not prescribed the same load as the lift', () => {
  const at5 = (name: string) =>
    seedWeightLbsFromBaselines({ exerciseName: name, baselines: LIFTER, targetReps: 5 })!;

  // Same movement family, very different loads. Both were prescribed identically at first.
  assert.ok(at5('Incline Bench Press') < at5('Bench Press'), 'incline is not a flat bench');
  assert.ok(at5('Romanian Deadlift') < at5('Deadlift'), 'an RDL is not a conventional pull');
  assert.ok(at5('Front Squat') < at5('Back Squat'), 'a front squat is not a back squat');
  assert.ok(at5('Close Grip Bench Press') < at5('Bench Press'));
  assert.ok(at5('Bulgarian Split Squat') < at5('Back Squat'));
});

test('higher reps prescribe a lighter load than lower reps', () => {
  const heavy = seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: LIFTER, targetReps: 5 })!;
  const light = seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: LIFTER, targetReps: 15 })!;
  assert.ok(light < heavy, `15 reps (${light}) must be lighter than 5 (${heavy})`);
});

test('a missing anchor lift is estimated from one that was reported', () => {
  const benchOnly: StrengthBaselines = { bench_press: { weightLbs: 185, reps: 5 } };

  // Never asked about the squat, but a squat start can still be reasoned about.
  const squatMax = estimatedMaxForLift(benchOnly, 'squat');
  assert.ok(squatMax && squatMax > estimatedMaxForLift(benchOnly, 'bench_press')!);

  const squat = seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: benchOnly, targetReps: 8 });
  assert.ok(squat && squat > 0);
});

test('no baselines means no opinion, so the caller keeps its own estimate', () => {
  assert.equal(seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: {}, targetReps: 8 }), undefined);
  assert.equal(seedWeightLbsFromBaselines({ exerciseName: 'Back Squat', baselines: null, targetReps: 8 }), undefined);
  // An unrecognised movement has no anchor to reason from.
  assert.equal(
    seedWeightLbsFromBaselines({ exerciseName: 'Battle Rope Grip Wave', baselines: LIFTER, targetReps: 10 }),
    undefined,
  );
});

test('a starting load is always a usable gym number', () => {
  for (const name of ['Bench Press', 'Back Squat', 'Romanian Deadlift', 'Lat Pulldown', 'Lateral Raise']) {
    const weight = seedWeightLbsFromBaselines({ exerciseName: name, baselines: LIFTER, targetReps: 10 });
    assert.ok(weight != null, `${name} should produce a start`);
    assert.equal(weight! % 5, 0, `${name} should land on a 5 lb increment, got ${weight}`);
    assert.ok(weight! >= 5, `${name} should never be below the lightest plate`);
  }
});

test('implausible entries are rejected rather than trained on', () => {
  assert.equal(isPlausibleBaseline({ weightLbs: 185, reps: 5 }), true);
  assert.equal(isPlausibleBaseline({ weightLbs: 0, reps: 5 }), false);
  assert.equal(isPlausibleBaseline({ weightLbs: 5000, reps: 5 }), false);
  assert.equal(isPlausibleBaseline({ weightLbs: 185, reps: 0 }), false);
  assert.equal(isPlausibleBaseline({ weightLbs: 185, reps: 50 }), false);
  assert.equal(isPlausibleBaseline(undefined), false);
});

test('stored baselines are sanitised on the way in', () => {
  const cleaned = sanitizeBaselines({
    bench_press: { weightLbs: 185, reps: 5 },
    squat: { weightLbs: '2200', reps: 5 },
    deadlift: { weightLbs: 315, reps: 5 },
    not_a_lift: { weightLbs: 100, reps: 5 },
  });

  assert.deepEqual(Object.keys(cleaned).sort(), ['bench_press', 'deadlift']);
  assert.equal(sanitizeBaselines(null).bench_press, undefined);
  assert.deepEqual(sanitizeBaselines('nonsense'), {});
});

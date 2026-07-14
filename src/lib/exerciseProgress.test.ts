import assert from 'node:assert/strict';

import {
    buildExerciseProgressSeries,
    defaultMetricForSeries,
    estimateOneRepMaxKg,
    summarizeProgressDelta,
} from './exerciseProgress';

function run() {
  assert.equal(estimateOneRepMaxKg(100, 1), 100);
  assert.equal(estimateOneRepMaxKg(100, 5), 116.7);
  assert.equal(estimateOneRepMaxKg(100, 13), null);
  assert.equal(estimateOneRepMaxKg(0, 5), null);

  const series = buildExerciseProgressSeries([
    { weightKg: 100, reps: 5, loggedAt: '2026-01-01T18:00:00Z' },
    { weightKg: 105, reps: 5, loggedAt: '2026-01-08T18:00:00Z' },
    { weightKg: 90, reps: 8, loggedAt: '2026-01-08T18:10:00Z' },
    { loggedAt: 'bad' } as never,
  ]);
  assert.equal(series.length, 2);
  assert.ok((series[1]!.estimated1RmKg ?? 0) > (series[0]!.estimated1RmKg ?? 0));

  assert.equal(defaultMetricForSeries(series), 'estimated_1rm');
  const summary = summarizeProgressDelta(series, 'estimated_1rm');
  assert.ok(summary);
  assert.ok((summary!.delta ?? 0) > 0);

  const empty = buildExerciseProgressSeries([]);
  assert.deepEqual(empty, []);
  assert.equal(summarizeProgressDelta(empty, 'estimated_1rm'), null);

  console.log('exerciseProgress.test.ts — PASS');
}

run();

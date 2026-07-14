import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildHeartRateZoneBuckets,
    estimateMaxHeartRate,
    heartRateZoneForBpm,
    supportsPowerMetrics,
} from './heartRateZones.js';

test('estimateMaxHeartRate uses Tanaka-style formula', () => {
  assert.equal(estimateMaxHeartRate(40), Math.round(208 - 0.7 * 40));
});

test('heartRateZoneForBpm maps into zones 1–5', () => {
  const maxHr = 180;
  assert.equal(heartRateZoneForBpm(95, maxHr), 1);
  assert.equal(heartRateZoneForBpm(120, maxHr), 2);
  assert.equal(heartRateZoneForBpm(140, maxHr), 3);
  assert.equal(heartRateZoneForBpm(155, maxHr), 4);
  assert.equal(heartRateZoneForBpm(170, maxHr), 5);
});

test('buildHeartRateZoneBuckets accumulates time-in-zone', () => {
  const zones = buildHeartRateZoneBuckets(
    [
      { bpm: 100, recordedAt: '2026-07-13T12:00:00.000Z' },
      { bpm: 150, recordedAt: '2026-07-13T12:00:10.000Z' },
      { bpm: 170, recordedAt: '2026-07-13T12:00:20.000Z' },
    ],
    35,
  );
  assert.equal(zones.length, 5);
  assert.ok(zones.some((zone) => zone.seconds > 0));
  assert.ok(zones.find((zone) => zone.zone === 5)?.seconds ?? 0 > 0);
});

test('supportsPowerMetrics only for watt-producing modalities', () => {
  assert.equal(supportsPowerMetrics('Steady Bike'), true);
  assert.equal(supportsPowerMetrics('Row Erg'), true);
  assert.equal(supportsPowerMetrics('Basketball'), false);
  assert.equal(supportsPowerMetrics('Equestrian'), false);
});

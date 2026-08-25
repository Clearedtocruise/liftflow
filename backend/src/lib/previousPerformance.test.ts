import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatPreviousPerformance, pickLatestPerformance } from './previousPerformance.js';

test('pickLatestPerformance returns the most recent set regardless of input order', () => {
  const latest = pickLatestPerformance([
    { weightKg: 80, reps: 8, loggedAt: '2026-01-01T10:00:00.000Z' },
    { weightKg: 84, reps: 6, loggedAt: '2026-02-01T10:00:00.000Z' },
    { weightKg: 82, reps: 7, loggedAt: '2026-01-15T10:00:00.000Z' },
  ]);
  assert.equal(latest?.weightKg, 84);
  assert.equal(latest?.reps, 6);
});

test('pickLatestPerformance returns null for no history', () => {
  assert.equal(pickLatestPerformance([]), null);
});

test('formats bench press as "185 lb × 8"', () => {
  // 185 lb ≈ 83.9 kg stored in the DB.
  const perf = { weightKg: 185 / 2.2046226218, reps: 8, loggedAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(formatPreviousPerformance(perf, 'lb'), '185 lb × 8');
});

test('formats in kg when requested', () => {
  const perf = { weightKg: 100, reps: 5, loggedAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(formatPreviousPerformance(perf, 'kg'), '100 kg × 5');
});

test('bodyweight sets show reps only', () => {
  assert.equal(formatPreviousPerformance({ weightKg: 0, reps: 12, loggedAt: '2026-01-01T00:00:00.000Z' }), '12 reps');
  assert.equal(formatPreviousPerformance({ weightKg: null, reps: 10, loggedAt: '2026-01-01T00:00:00.000Z' }), '10 reps');
});

test('no performance renders an em dash', () => {
  assert.equal(formatPreviousPerformance(null), '—');
  assert.equal(formatPreviousPerformance({ weightKg: null, reps: null, loggedAt: '2026-01-01T00:00:00.000Z' }), '—');
});

#!/usr/bin/env node
/**
 * Sprint 7.4 — Health sync engine unit tests
 */

function sampleKey(sample) {
  if (sample.externalId) return `${sample.dataType}:${sample.externalId}`;
  return `${sample.dataType}:${sample.recordedAt}`;
}

function resolveHealthConflict(existing, incoming, policy = 'latest_wins') {
  if (policy === 'healthkit_wins') {
    if ((incoming.value?.provider ?? '').includes('health')) return 'replace';
    if ((existing.source ?? '').includes('health')) return 'keep';
  }
  const existingTime = new Date(existing.recordedAt).getTime();
  const incomingTime = new Date(incoming.recordedAt).getTime();
  return incomingTime >= existingTime ? 'replace' : 'keep';
}

function mergeHealthSamples(existing, incoming) {
  const map = new Map();
  for (const row of existing) map.set(sampleKey(row), row);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;
  for (const sample of incoming) {
    const prev = map.get(sampleKey(sample));
    if (!prev) {
      inserted += 1;
      map.set(sampleKey(sample), sample);
      continue;
    }
    conflicts += 1;
    if (resolveHealthConflict(prev, sample) === 'replace') updated += 1;
    else skipped += 1;
  }
  return { inserted, updated, skipped, conflicts };
}

function summarizeHealthByDay(samples) {
  const byDate = new Map();
  for (const s of samples) {
    const date = s.recordedAt.slice(0, 10);
    const row = byDate.get(date) ?? { date };
    if (s.dataType === 'sleep') row.sleepHours = (row.sleepHours ?? 0) + Number(s.value.hours ?? 0);
    if (s.dataType === 'hrv') row.hrvMs = Number(s.value.ms ?? row.hrvMs);
    if (s.dataType === 'steps') row.steps = (row.steps ?? 0) + Number(s.value.count ?? 0);
    byDate.set(date, row);
  }
  return [...byDate.values()];
}

const checks = [];
function pass(n, d = '') { checks.push({ n, s: 'PASS', d }); console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`); }
function fail(n, d = '') { checks.push({ n, s: 'FAIL', d }); console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); }

console.log('=== Health Sync Engine Tests ===\n');

const existing = [{ dataType: 'heart_rate', externalId: 'abc', recordedAt: '2026-05-01T10:00:00Z', source: 'apple_healthkit', value: { bpm: 120 } }];
const incoming = [{ dataType: 'heart_rate', externalId: 'abc', recordedAt: '2026-05-01T11:00:00Z', value: { bpm: 130, provider: 'apple_healthkit' } }];
const merge = mergeHealthSamples(existing, incoming);
if (merge.updated === 1 && merge.conflicts === 1) pass('Conflict resolves to newer sample');
else fail('Conflict resolution', JSON.stringify(merge));

const stale = [{ dataType: 'weight', externalId: 'w1', recordedAt: '2026-05-02T08:00:00Z', value: { kg: 80 } }];
const older = [{ dataType: 'weight', externalId: 'w1', recordedAt: '2026-05-01T08:00:00Z', value: { kg: 79 } }];
const skipMerge = mergeHealthSamples(stale, older);
if (skipMerge.skipped === 1) pass('Older sample skipped');
else fail('Skip stale');

const days = summarizeHealthByDay([
  { dataType: 'sleep', recordedAt: '2026-05-01T07:00:00Z', value: { hours: 7.5 } },
  { dataType: 'hrv', recordedAt: '2026-05-01T06:00:00Z', value: { ms: 45 } },
  { dataType: 'steps', recordedAt: '2026-05-01T20:00:00Z', value: { count: 8000 } },
]);
if (days[0]?.sleepHours === 7.5 && days[0]?.hrvMs === 45 && days[0]?.steps === 8000) pass('Daily health summary');
else fail('Daily summary');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

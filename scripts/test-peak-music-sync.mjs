#!/usr/bin/env node
/** Peak playback timing unit tests */

function computePeakPlaybackPlan(peakOffsetMs, restDurationMs) {
  const seekToMs = Math.max(0, peakOffsetMs - restDurationMs);
  const startDelayMs = peakOffsetMs < restDurationMs ? restDurationMs - peakOffsetMs : 0;
  return { seekToMs, startDelayMs };
}

function shouldAutoSync(settings, ctx) {
  if (!settings.enabled) return false;
  if (!settings.autoSyncHeavySetsOnly && !settings.autoSyncPrAttemptsOnly) return true;
  if (settings.autoSyncHeavySetsOnly && ctx?.isHeavySet) return true;
  if (settings.autoSyncPrAttemptsOnly && ctx?.isPrAttempt) return true;
  return false;
}

const checks = [];
function pass(n, d = '') {
  checks.push(1);
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push(0);
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

console.log('=== Peak Music Sync Tests ===\n');

const plan = computePeakPlaybackPlan(90000, 90000);
if (plan.seekToMs === 0 && plan.startDelayMs === 0) pass('90s peak, 90s rest → seek 0');
else fail('90s alignment', JSON.stringify(plan));

const plan2 = computePeakPlaybackPlan(120000, 90000);
if (plan2.seekToMs === 30000) pass('2min peak, 90s rest → seek 30s');
else fail('2min peak seek', String(plan2.seekToMs));

const plan3 = computePeakPlaybackPlan(45000, 90000);
if (plan3.seekToMs === 0 && plan3.startDelayMs === 45000) pass('Short peak → delayed start');
else fail('Delayed start', JSON.stringify(plan3));

if (shouldAutoSync({ enabled: true, autoSyncHeavySetsOnly: false, autoSyncPrAttemptsOnly: false }, {})) pass('Auto-sync when enabled');
else fail('Auto-sync default');

if (!shouldAutoSync({ enabled: true, autoSyncHeavySetsOnly: true, autoSyncPrAttemptsOnly: false }, {})) pass('Heavy-only blocks warm-up');
else fail('Heavy-only filter');

if (shouldAutoSync({ enabled: true, autoSyncHeavySetsOnly: true, autoSyncPrAttemptsOnly: false }, { isHeavySet: true })) {
  pass('Heavy set triggers sync');
} else fail('Heavy set sync');

const passed = checks.filter(Boolean).length;
console.log(`\n=== Summary: ${passed}/${checks.length} PASS ===`);
process.exit(passed === checks.length ? 0 : 1);

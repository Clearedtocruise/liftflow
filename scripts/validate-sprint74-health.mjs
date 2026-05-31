#!/usr/bin/env node
/**
 * Sprint 7.4 — Apple Health & Watch Integration validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') { checks.push({ n, s: 'PASS', d }); console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`); }
function fail(n, d = '') { checks.push({ n, s: 'FAIL', d }); console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); }

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

console.log('=== Sprint 7.4 Apple Health & Watch Validation ===\n');

const requiredFiles = [
  'src/integrations/healthConstants.ts',
  'src/integrations/healthkitProvider.ts',
  'src/lib/healthSyncEngine.ts',
  'src/services/healthService.ts',
  'src/hooks/useHealthSync.ts',
  'backend/src/lib/healthSyncEngine.ts',
  'backend/src/lib/loadHealthContext.ts',
  'src/integrations/watch/watchHealthArchitecture.ts',
  'src/integrations/watch/workoutDetection.ts',
  'src/integrations/watch/heartRateMonitor.ts',
  'supabase/migrations/012_health_integration.sql',
];

for (const f of requiredFiles) {
  if (exists(f)) pass('File', f);
  else fail('Missing file', f);
}

const provider = read('src/integrations/healthConstants.ts');
for (const type of ['heart_rate', 'resting_heart_rate', 'hrv', 'sleep', 'steps', 'weight', 'active_calories', 'workout_session']) {
  if (provider.includes(type)) pass('Health data type', type);
  else fail('Missing data type', type);
}

const hk = read('src/integrations/healthkitProvider.ts');
if (hk.includes('RestingHeartRate') && hk.includes('HeartRateVariabilitySDNN') && hk.includes('SleepAnalysis')) {
  pass('HealthKit quantity/category types');
} else fail('HealthKit extended types');

const syncEngine = read('src/lib/healthSyncEngine.ts');
if (syncEngine.includes('mergeHealthSamples') && syncEngine.includes('resolveHealthConflict')) pass('Client sync engine');
else fail('Client sync engine');

const healthService = read('src/services/healthService.ts');
if (healthService.includes('requestPermissions') && healthService.includes('persistMerged')) pass('Health service');
else fail('Health service');

const hook = read('src/hooks/useHealthSync.ts');
if (hook.includes('requestPermissions') && hook.includes('sync')) pass('useHealthSync hook');
else fail('useHealthSync hook');

const backend = read('backend/src/lib/loadRecoveryIntelligence.ts');
if (backend.includes('loadHealthContext') && backend.includes('healthKitAvailable')) pass('Recovery wired to health');
else fail('Recovery health wiring');

const integrations = read('backend/src/routes/integrations.ts');
if (integrations.includes('/health/context') && integrations.includes('mergeIncomingHealthSamples')) pass('Backend health routes');
else fail('Backend health routes');

const watch = read('src/integrations/watch/watchHealthArchitecture.ts');
if (watch.includes('workout_detection') && watch.includes('heart_rate_sample') && watch.includes('movement_event')) {
  pass('Watch architecture messages');
} else fail('Watch architecture');

const screen = read('src/app/(features)/healthkit.tsx');
if (screen.includes('useHealthSync') && screen.includes('Request Health Permissions')) pass('Permission flow UI');
else fail('Permission flow UI');

console.log('\n--- Unit tests ---');
const testRun = spawnSync('node', ['scripts/test-health-sync.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(testRun.stdout ?? '');
if (testRun.stderr) process.stderr.write(testRun.stderr);
if (testRun.status === 0) pass('Unit tests', 'all passed');
else fail('Unit tests');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.4 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * Sprint 7.2 — Recovery Intelligence Engine validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log('=== Sprint 7.2 Recovery Intelligence Validation ===\n');

const requiredFiles = [
  'backend/src/lib/recoveryIntelligenceEngine.ts',
  'backend/src/lib/loadRecoveryIntelligence.ts',
  'src/types/recoveryIntelligence.ts',
  'src/lib/recoveryIntelligenceEngine.ts',
  'src/services/recoveryService.ts',
  'src/components/recovery/RecoveryIntelligenceDashboard.tsx',
  'src/components/recovery/MuscleRecoveryHeatMap.tsx',
  'src/components/recovery/RecoveryTrendChart.tsx',
  'src/app/(features)/recovery-analysis.tsx',
];

for (const f of requiredFiles) {
  if (exists(f)) pass('File', f);
  else fail('Missing file', f);
}

const engine = read('backend/src/lib/recoveryIntelligenceEngine.ts');
for (const token of [
  'computeRecoveryIntelligence',
  'computeMuscleRecovery',
  'fully_recovered',
  'train_light',
  'recovery_session',
  'rest_day',
  'RECOVERY_MUSCLE_GROUPS',
]) {
  if (engine.includes(token)) pass('Engine', token);
  else fail('Engine missing', token);
}

const route = read('backend/src/routes/training.ts');
if (route.includes('/recovery/intelligence')) pass('API route', '/recovery/intelligence');
else fail('API route');

const voice = read('src/lib/voice/parseVoiceCommand.ts');
if (voice.includes('recovery_query') && voice.includes('train_today_query')) pass('Voice intents');
else fail('Voice intents');

const workout = read('src/app/(tabs)/workout.tsx');
if (workout.includes('recovery_query') && workout.includes('getIntelligence')) pass('Workout voice wiring');
else fail('Workout voice wiring');

const dashboard = read('src/components/recovery/RecoveryIntelligenceDashboard.tsx');
if (dashboard.includes('MuscleRecoveryHeatMap') && dashboard.includes('RecoveryTrendChart')) {
  pass('Dashboard components');
} else fail('Dashboard components');

console.log('\n--- Unit tests ---');
const testRun = spawnSync('node', ['scripts/test-recovery-intelligence.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(testRun.stdout ?? '');
if (testRun.stderr) process.stderr.write(testRun.stderr);
if (testRun.status === 0) pass('Unit tests', 'all passed');
else fail('Unit tests', 'see output above');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.2 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

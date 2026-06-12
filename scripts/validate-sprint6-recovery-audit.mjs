#!/usr/bin/env node
/**
 * Sprint 6 — Recovery & Readiness audit validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 6 Recovery & Readiness Audit ===\n');

for (const file of [
  'backend/src/lib/recoveryScore.ts',
  'backend/src/lib/recoveryIntelligenceEngine.ts',
  'backend/src/lib/loadRecoveryIntelligence.ts',
  'docs/SPRINT6_RECOVERY_AUDIT_REPORT.md',
  'src/types/recoveryIntelligence.ts',
  'src/components/recovery/RecoveryIntelligenceDashboard.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const score = read('backend/src/lib/recoveryScore.ts');
const engine = read('backend/src/lib/recoveryIntelligenceEngine.ts');
const dashboard = read('src/app/(tabs)/dashboard.tsx');
const intelUi = read('src/components/recovery/RecoveryIntelligenceDashboard.tsx');
const types = read('src/types/recoveryIntelligence.ts');

for (const token of [
  'SUBJECTIVE_INPUT_WEIGHTS',
  'MISSING_INPUT_DEFAULT_SCORE',
  'describeSubjectiveInputs',
]) {
  record(`recoveryScore: ${token}`, score.includes(token));
}

for (const token of [
  'RECOVERY_COMPOSITE_WEIGHTS',
  'RecoveryTransparency',
  'buildTransparency',
  'transparency',
]) {
  record(`recoveryIntelligenceEngine: ${token}`, engine.includes(token));
}

record('Types include RecoveryTransparency', types.includes('RecoveryTransparency'));
record('Intelligence UI shows How this score works', intelUi.includes('How this score works'));
record('Intelligence UI labels Readiness factor', intelUi.includes('Readiness'));
record('Dashboard removed fake 88/72/65 fallback', !dashboard.includes('? 88 :'));
record('Dashboard shows check-in empty state', dashboard.includes('Check in for your score'));
record('Loader passes inputSources for sleep', read('backend/src/lib/loadRecoveryIntelligence.ts').includes('inputSources'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
for (const testFile of ['recoveryScore.test.ts', 'recoveryIntelligenceEngine.test.ts']) {
  const testRun = fs.existsSync(backendTsx)
    ? spawnSync(process.execPath, [backendTsx, `src/lib/${testFile}`], {
        cwd: path.join(root, 'backend'),
        encoding: 'utf8',
      })
    : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
  record(
    `Unit tests (${testFile})`,
    testRun.status === 0,
    testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 120),
  );
}

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

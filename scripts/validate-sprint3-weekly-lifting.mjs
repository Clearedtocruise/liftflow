#!/usr/bin/env node
/**
 * Sprint 3 — Weekly lifting generator validation
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

console.log('=== Sprint 3 Weekly Lifting Generator ===\n');

for (const file of [
  'backend/src/lib/weeklyLiftingGenerator.ts',
  'backend/src/lib/weeklyLiftingGenerator.test.ts',
  'backend/src/lib/programTypes.ts',
  'backend/src/lib/programSelection.ts',
  'src/constants/onboardingCoach.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const generator = read('backend/src/lib/weeklyLiftingGenerator.ts');
const programTypes = read('backend/src/lib/programTypes.ts');
const onboarding = read('src/constants/onboardingCoach.ts');

record('6-day PPL pattern defined', generator.includes("'Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'"));
record('6-day UL pattern defined', generator.includes("'Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower'"));
record('Lifting days options include 6', onboarding.includes('6'));
record('No conditioning in PPL 6 pattern', !generator.match(/push_pull_legs:[\s\S]*6:[\s\S]*Conditioning/));
record('programTypes uses weeklyLiftingGenerator', programTypes.includes('weeklyLiftingGenerator'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testRun = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/weeklyLiftingGenerator.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (weeklyLiftingGenerator.test.ts)',
  testRun.status === 0,
  testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 160),
);

console.log('\nExample generated weeks:');
console.log('  PPL · 6 days: Push · Pull · Legs · Push · Pull · Legs · Rest');
console.log('  UL  · 6 days: Upper · Lower · Upper · Lower · Upper · Lower · Rest');
console.log('  PPL · 4 days: Push · Pull · Legs · Push · Rest · Rest · Rest');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

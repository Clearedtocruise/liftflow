#!/usr/bin/env node
/**
 * Sprint 10 — Production Polish validation
 * Validates deliverables exist and documents known P0 gaps for tracking.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '', required = true) {
  checks.push({ name, pass, detail, required });
  const tag = required ? '' : ' (tracking)';
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${tag}${detail ? ' — ' + detail : ''}`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 10 Production Polish ===\n');

console.log('--- Deliverables ---');
for (const file of [
  'docs/SPRINT10_FINAL_AUDIT.md',
  'docs/SPRINT10_PRODUCTION_CHECKLIST.md',
  'docs/SPRINT10_LAUNCH_RECOMMENDATION.md',
]) {
  record(`File exists: ${file}`, exists(file));
}

const audit = read('docs/SPRINT10_FINAL_AUDIT.md');
const checklist = read('docs/SPRINT10_PRODUCTION_CHECKLIST.md');
const launch = read('docs/SPRINT10_LAUNCH_RECOMMENDATION.md');

for (const token of [
  'Workout UX',
  'Nutrition UX',
  'Recovery UX',
  'Readiness UX',
  'AI Coaching',
  'Loading states',
  'Empty states',
  'Typography',
  'Visual hierarchy',
  '66/100',
]) {
  record(`Audit covers: ${token}`, audit.includes(token));
}

record('Checklist: Batch A dead ends', checklist.includes('Batch A'));
record('Checklist: Batch B coach', checklist.includes('Batch B'));
record('Checklist: Batch C recovery', checklist.includes('Batch C'));
record('Checklist: acceptance criteria', checklist.includes('No obvious UX friction'));
record('Launch: conditional recommendation', launch.includes('CONDITIONAL GO') || launch.includes('NOT YET'));
record('Launch: beta before public', launch.includes('Sprint 9') || launch.includes('beta'));

console.log('\n--- Known P0 gaps (open until Batch A–C fixed) ---');
const dayTsx = read('src/app/(tabs)/workout/day.tsx');
const coachingTsx = read('src/app/(tabs)/coaching.tsx');
const dashboardTsx = read('src/app/(tabs)/dashboard.tsx');
const coachCard = read('src/components/workout/ExerciseCoachCard.tsx');

record('W-P0-1 day.tsx dead-end spinner', dayTsx.includes('loading || !workout'), 'known gap', false);
record('C-P0-1 coaching paywall on null intel', coachingTsx.includes('UpgradePrompt'), 'known gap', false);
record('R-P0-2 recovery ring fixed green', dashboardTsx.includes('color={LiftFlowColors.success}'), 'known gap', false);
record('W-P0-4 coach silent failure', coachCard.includes('if (!prescription) return null'), 'known gap', false);

console.log('\n--- Regression ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

const required = checks.filter((c) => c.required !== false);
const requiredPass = required.filter((c) => c.pass).length;
const pass = checks.filter((c) => c.pass).length;
console.log(`\nSummary: ${pass}/${checks.length} checks (${requiredPass}/${required.length} required)`);
console.log('\nNote: P0 tracking items are expected FAIL until Sprint 10 implementation batches ship.');

if (requiredPass !== required.length) process.exit(1);

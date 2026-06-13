#!/usr/bin/env node
/**
 * Sprint 8 — AI coaching restoration validation
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

console.log('=== Sprint 8 AI Coaching Restoration ===\n');

for (const file of [
  'backend/src/lib/exerciseCoachPrescription.ts',
  'backend/src/lib/exerciseCoachPrescription.test.ts',
  'docs/SPRINT8_COACHING_ARCHITECTURE.md',
  'src/types/exerciseCoach.ts',
  'src/lib/coachAdjustmentLabels.ts',
  'src/services/exerciseCoachService.ts',
  'src/components/workout/ExerciseCoachCard.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const prescription = read('backend/src/lib/exerciseCoachPrescription.ts');
const routes = read('backend/src/routes/training.ts');
const activeWorkout = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const detailList = read('src/components/workout/execution/WorkoutExerciseDetailList.tsx');
const coachCard = read('src/components/workout/ExerciseCoachCard.tsx');

for (const token of [
  'loadExerciseCoachPrescription',
  'loadWorkoutExercisePrescriptions',
  'resolveTargetSets',
  'buildWhySelected',
  'detailedReason',
  'increase_sets',
]) {
  record(`Prescription engine: ${token}`, prescription.includes(token));
}

record('API route /coaching/exercise-prescription', routes.includes('/coaching/exercise-prescription'));
record('API route /coaching/workout-prescriptions', routes.includes('/coaching/workout-prescriptions'));
record('Active workout uses ExerciseCoachCard', activeWorkout.includes('ExerciseCoachCard'));
record('Day overview loads batch prescriptions', detailList.includes('getWorkoutPrescriptions'));
record('Coach card surfaces detailedReason', coachCard.includes('detailedReason'));
record('Coach card surfaces whySelected', coachCard.includes('whySelected'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testRun = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/exerciseCoachPrescription.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (exerciseCoachPrescription.test.ts)',
  testRun.status === 0,
  testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 120),
);

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

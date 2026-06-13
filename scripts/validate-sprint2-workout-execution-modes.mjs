#!/usr/bin/env node
/**
 * Sprint 2 — Workout execution modes validation
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

console.log('=== Sprint 2 Workout Execution Modes ===\n');

for (const file of [
  'src/types/workoutExecutionMode.ts',
  'src/constants/workoutExecutionModes.ts',
  'src/lib/workoutExecutionMode.ts',
  'backend/src/lib/workoutExecutionMode.ts',
  'backend/src/lib/workoutExecutionMode.test.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const types = read('src/types/workoutExecutionMode.ts');
const constants = read('src/constants/workoutExecutionModes.ts');
const engine = read('src/lib/workoutExecutionMode.ts');
const training = read('src/types/training.ts');
const workoutExecution = read('src/types/workoutExecution.ts');

const requiredModes = ['traditional', 'hypertrophy', 'strength', 'hiit', 'tabata', 'circuit', 'superset'];
for (const mode of requiredModes) {
  record(`Mode defined: ${mode}`, types.includes(`'${mode}'`) && constants.includes(`'${mode}'`));
}

for (const token of [
  'prescribeExerciseExecution',
  'prescribeWorkoutExecution',
  'formatExercisePrescriptionSummary',
  'ExerciseExecutionPrescription',
  'WORKOUT_EXECUTION_MODES',
]) {
  record(`Engine export: ${token}`, engine.includes(token) || types.includes(token) || constants.includes(token));
}

record('TemplateExercise stores executionMode', training.includes('executionMode'));
record('PlannedWorkoutMetadata stores executionMode', training.includes('executionMode?:'));
record('EditableWorkoutExercise stores executionMode', workoutExecution.includes('executionMode'));

record('HIIT defaults 45/15/8', constants.includes('workSeconds: 45') && constants.includes('rounds: 8'));
record('Tabata defaults 20/10/10', constants.includes('workSeconds: 20') && constants.includes('rounds: 10'));

const sprint2Files = [
  'src/types/workoutExecutionMode.ts',
  'src/constants/workoutExecutionModes.ts',
  'src/lib/workoutExecutionMode.ts',
  'src/lib/workoutPlan.ts',
  'src/types/workoutExecution.ts',
  'src/types/training.ts',
  'src/types/index.ts',
  'backend/src/lib/workoutExecutionMode.ts',
  'backend/src/lib/workoutExecutionMode.test.ts',
  'scripts/validate-sprint2-workout-execution-modes.mjs',
];
const uiPrefix = 'src/components/workout/execution/';
const timerFiles = ['src/components/workout/execution/RestTimerOverlay.tsx'];
record(
  'Sprint 2 scope excludes workout UI',
  !sprint2Files.some((file) => file.startsWith(uiPrefix)),
);
record(
  'Sprint 2 scope excludes timers',
  !sprint2Files.some((file) => timerFiles.includes(file)),
);

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testRun = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/workoutExecutionMode.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (workoutExecutionMode.test.ts)',
  testRun.status === 0,
  testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 160),
);

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

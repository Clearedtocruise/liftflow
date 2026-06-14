#!/usr/bin/env node
/**
 * Timed exercise hotfix — duration-based coach, no strength deload path.
 */
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

console.log('=== Timed Exercise Hotfix ===\n');

for (const file of [
  'backend/src/lib/timedProgressionEngine.ts',
  'backend/src/lib/exerciseCoachPrescription.ts',
  'src/lib/exerciseModality.ts',
  'src/components/workout/execution/ActiveWorkoutScreen.tsx',
  'src/components/workout/ExerciseCoachCard.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const timed = read('backend/src/lib/timedProgressionEngine.ts');
const coach = read('backend/src/lib/exerciseCoachPrescription.ts');
const modality = read('src/lib/exerciseModality.ts');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const coachCard = read('src/components/workout/ExerciseCoachCard.tsx');
const workoutIndex = read('src/app/(tabs)/workout/index.tsx');

record('Timed progression engine', timed.includes('computeTimedProgression') && timed.includes('formatDurationDelta'));
record(
  'Coach branches to timed prescription',
  coach.includes('loadTimedExerciseCoachPrescription') && coach.includes("plan?.loggingMode === 'timed'"),
);
record(
  'Timed rep range overrides strength type',
  modality.includes('isTimedExercise(exercise, range, label)'),
);
record(
  'Active workout sends duration sets to coach',
  active.includes("loggingMode === 'timed'") && active.includes('durationSeconds: set.durationSeconds'),
);
record('Log set uses try/finally', active.includes('finally') && active.includes('setLogging(false)'));
record(
  'Programmed sets no longer inflate with logged count',
  workoutIndex.includes('sets: 3,') && !workoutIndex.includes('exercise.sets.length + 1'),
);
record(
  'Coach card passes loggingMode',
  coachCard.includes('loggingMode,') && coachCard.includes('currentSessionSets'),
);

console.log('\nRule: timed exercises compare completedDuration vs targetDuration — never deload load');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

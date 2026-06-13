#!/usr/bin/env node
/**
 * Sprint 6 — Smart logging validation (distinct from recovery audit sprint 6)
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

console.log('=== Sprint 6 Smart Logging ===\n');

for (const file of [
  'src/lib/exerciseModality.ts',
  'src/lib/exerciseClassification.ts',
  'src/components/workout/execution/SetLoggingControls.tsx',
  'src/components/workout/ManualSetEntry.tsx',
  'src/components/cardio/CardioSessionPanel.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const modality = read('src/lib/exerciseModality.ts');
const controls = read('src/components/workout/execution/SetLoggingControls.tsx');
const manual = read('src/components/workout/ManualSetEntry.tsx');
const cardio = read('src/components/cardio/CardioSessionPanel.tsx');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const workoutService = read('src/services/workoutService.ts');

record('Logging mode includes cardio', modality.includes("'cardio'"));
record('Uses Sprint 1 exerciseType', modality.includes('exerciseTypeToLoggingMode') && modality.includes('classifyExercise'));
record('Strength fields: weight + reps', controls.includes("label={`WEIGHT") && controls.includes('label="REPS"'));
record('Bodyweight fields: reps only branch', controls.includes("mode === 'bodyweight'"));
record('Timed fields: duration only branch', controls.includes("mode === 'timed'") && controls.includes('DURATION (SEC)'));
record('Cardio fields: time + distance', controls.includes("mode === 'cardio'") && controls.includes('DISTANCE'));
record('Manual log uses SetLoggingControls', manual.includes('SetLoggingControls'));
record('Manual log classifies by name', manual.includes('getExerciseLoggingModeByName'));
record('Cardio panel captures distance', cardio.includes('Distance') && cardio.includes('distanceText'));
record('Active workout logs distanceMeters', active.includes('distanceMeters'));
record('logSet persists distance metadata', workoutService.includes('distanceMeters'));

console.log('\nExamples:');
console.log('  Strength    → weight + reps');
console.log('  Bodyweight  → reps');
console.log('  Timed       → duration (sec)');
console.log('  Cardio      → time + distance');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

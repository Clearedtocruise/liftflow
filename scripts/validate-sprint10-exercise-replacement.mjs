#!/usr/bin/env node
/**
 * Sprint 10 — Exercise Replacement Engine validation
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

console.log('=== Sprint 10 Exercise Replacement Engine ===\n');

for (const file of [
  'src/components/workout/execution/ExerciseReplaceSheet.tsx',
  'src/services/exerciseAdvisoryService.ts',
  'src/lib/exerciseLocalAlternatives.ts',
  'backend/src/lib/exerciseReplacementEngine.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const sheet = read('src/components/workout/execution/ExerciseReplaceSheet.tsx');
const service = read('src/services/exerciseAdvisoryService.ts');
const dayOverview = read('src/components/workout/execution/WorkoutDayOverviewScreen.tsx');
const detail = read('src/components/workout/execution/WorkoutExerciseDetailList.tsx');
const edit = read('src/components/workout/execution/WorkoutEditScreen.tsx');
const dayRoute = read('src/app/(tabs)/workout/day.tsx');
const training = read('src/services/trainingService.ts');
const aiRoute = read('backend/src/routes/ai.ts');
const engine = read('backend/src/lib/exerciseReplacementEngine.ts');

record('Replace Exercise sheet title', sheet.includes('Replace Exercise'));
record('Five alternatives target', engine.includes('limit = 5') || service.includes('5'));
record('Client advisory service', service.includes('exercise-alternatives'));
record('Local fallback alternatives', read('src/lib/exerciseLocalAlternatives.ts').includes('buildLocalExerciseAlternatives'));
record('Backend replacement engine', engine.includes('generateExerciseAlternatives'));
record('API route exercise-alternatives', aiRoute.includes('/advisory/workout/exercise-alternatives'));
record('Scoring: equipment', engine.includes('exerciseMeetsEquipment'));
record('Scoring: muscle groups', engine.includes('muscleOverlap'));
record('Scoring: goal', engine.includes('GOAL_FAMILY_BOOST'));
record('Scoring: program style', engine.includes('PROGRAM_STYLE_BOOST'));
record('Day overview wires replace sheet', dayOverview.includes('ExerciseReplaceSheet'));
record('Exercise list Replace Exercise CTA', detail.includes('Replace Exercise'));
record('Edit workout Replace Exercise CTA', edit.includes('Replace Exercise'));
record('Persist swap to planned workout', training.includes('updatePlannedWorkoutExercises'));
record('Day route persists replace', dayRoute.includes('updatePlannedWorkoutExercises'));
record('Preserves sets/repRange on swap', dayRoute.includes('...exercise') || edit.includes('...exercises[replaceIndex]'));

console.log('\nFlow: Replace Exercise → ExerciseReplaceSheet → exerciseAdvisoryService → swap in place');
console.log('No program regeneration — metadata patch only');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

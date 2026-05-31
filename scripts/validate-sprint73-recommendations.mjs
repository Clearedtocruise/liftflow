#!/usr/bin/env node
/**
 * Sprint 7.3 — Workout Recommendation Engine validation
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

console.log('=== Sprint 7.3 Workout Recommendation Validation ===\n');

const requiredFiles = [
  'backend/src/lib/workoutRecommendationEngine.ts',
  'backend/src/lib/loadWorkoutRecommendations.ts',
  'src/types/workoutRecommendation.ts',
  'src/services/workoutRecommendationService.ts',
  'src/components/workout/WorkoutRecommendationPanel.tsx',
  'src/app/(features)/suggested-workouts.tsx',
];

for (const f of requiredFiles) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing file', f);
}

const engine = read('backend/src/lib/workoutRecommendationEngine.ts');
for (const token of [
  'computeWorkoutRecommendations',
  'whySelected',
  'whyNotSelected',
  'push_pull_legs',
  'bodybuilding',
  'powerlifting',
  'loadRecoveryIntelligence',
  'weeklyPlan',
  'voiceBuildWorkoutLine',
]) {
  if (engine.includes(token) || read('backend/src/lib/loadWorkoutRecommendations.ts').includes(token)) {
    pass('Engine', token);
  } else fail('Engine missing', token);
}

const route = read('backend/src/routes/training.ts');
if (route.includes('/recommendations/daily')) pass('API route');
else fail('API route');

const loader = read('backend/src/lib/loadWorkoutRecommendations.ts');
if (loader.includes('workout_sessions') && loader.includes('planned_workouts') && loader.includes('loadRecoveryIntelligence')) {
  pass('Uses real user data', 'sessions + planned + recovery');
} else fail('Real data wiring');

const voice = read('src/lib/voice/parseVoiceCommand.ts');
if (voice.includes('train_today_query') && voice.includes('build_workout')) pass('Voice intents');
else fail('Voice intents');

const workout = read('src/app/(tabs)/workout.tsx');
if (workout.includes('workoutRecommendationService') && workout.includes('build_workout')) pass('Workout voice wiring');
else fail('Workout voice wiring');

const panel = read('src/components/workout/WorkoutRecommendationPanel.tsx');
if (panel.includes('whyNotSelected') && panel.includes('weeklyPlan')) pass('Recommendation UI');
else fail('Recommendation UI');

console.log('\n--- Unit tests ---');
const testRun = spawnSync('node', ['scripts/test-workout-recommendations.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(testRun.stdout ?? '');
if (testRun.stderr) process.stderr.write(testRun.stderr);
if (testRun.status === 0) pass('Unit tests', 'all passed');
else fail('Unit tests');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.3 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * Pre-TestFlight local gate for the stability / outage / voice fixes.
 * Fast static + API smoke. Exit 1 on any failure.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadRootEnv();
const api = (env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com').replace(/\/$/, '');

let fail = 0;
function pass(name, detail = '') {
  console.log(`  PASS — ${name}${detail ? ` — ${detail}` : ''}`);
}
function failCheck(name, detail = '') {
  fail += 1;
  console.log(`  FAIL — ${name}${detail ? ` — ${detail}` : ''}`);
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function mustInclude(rel, label, patterns) {
  const src = read(rel);
  const missing = patterns.filter((p) => !src.includes(p));
  if (missing.length) failCheck(label, `missing: ${missing.join(', ')}`);
  else pass(label);
}
function mustNotInclude(rel, label, patterns) {
  const src = read(rel);
  const found = patterns.filter((p) => src.includes(p));
  if (found.length) failCheck(label, `forbidden: ${found.join(', ')}`);
  else pass(label);
}

console.log('=== Pre-build local gate ===\n');

console.log('Static product guards');
mustInclude('src/voice/VoiceMicButton.tsx', 'Voice Log starts without forced test', [
  "onPress={() => void startCommandListening()}",
  'Optional: improve accuracy',
]);
mustNotInclude('src/voice/VoiceMicButton.tsx', 'No forced Quick voice test alert', [
  'Quick voice test',
  'Take test',
]);
mustInclude('src/lib/voice/voiceLoggingTest.ts', 'Voice test skip persistence', [
  'VOICE_TEST_SKIPPED_KEY',
  'markVoiceLoggingTestSkipped',
]);
mustInclude('backend/src/lib/programEngine.ts', 'Regen builds before cancel', [
  'Never cancel existing planned workouts until the new week is inserted',
  'insertedPlannedIds',
  'WEEKS_AHEAD = 0',
]);
mustInclude('backend/src/lib/programEngine.ts', 'Week fetch never force-regens', [
  'Never force-regenerate on a read path',
]);
mustInclude('src/services/trainingService.ts', 'Client force-rebuilds under-built weeks', [
  'calendarLiftDays < preferredDays',
  'forceRegenerateProgram(userId)',
]);
mustInclude('src/app/(tabs)/settings.tsx', 'Settings rebuild week action', [
  "label=\"Rebuild this week's plan\"",
  'forceRegenerateProgram(user.id)',
]);
mustInclude('backend/src/lib/programTypes.ts', 'Spacing preserves lift days', [
  'Never converts a lift day into Rest',
]);
mustInclude('src/components/nutrition/NutritionProgressHeader.tsx', 'Nutrition Calories left label', [
  'Calories left',
]);

console.log('\nUnit tests');
const unit = spawnSync(
  'npx',
  [
    'tsx',
    '--test',
    'src/lib/stabilitySprint.regression.test.ts',
    'src/lib/mapHealthKitWorkoutToCardio.test.ts',
    'src/lib/mealReplacement.test.ts',
    'src/lib/voice/voiceLoggingAccuracy.test.ts',
    'backend/src/lib/weeklyLiftingGenerator.test.ts',
    'backend/src/lib/workoutExecutionMode.test.ts',
    'backend/src/lib/exerciseClassification.test.ts',
  ],
  { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
);
if (unit.status === 0) pass('Core unit/regression suite');
else {
  failCheck('Core unit/regression suite', (unit.stderr || unit.stdout || '').split('\n').slice(-8).join(' | '));
}

console.log('\nBackend build');
const build = spawnSync('npm', ['run', 'build'], {
  cwd: path.join(root, 'backend'),
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (build.status === 0) pass('backend tsc');
else failCheck('backend tsc', (build.stderr || build.stdout || '').slice(-200));

console.log('\nAPI smoke');
async function smoke() {
  try {
    const health = await fetch(`${api}/health`, { signal: AbortSignal.timeout(15000) });
    if (health.ok) pass('API /health', String(health.status));
    else failCheck('API /health', String(health.status));
  } catch (e) {
    failCheck('API /health', e instanceof Error ? e.message : String(e));
  }

  try {
    const meal = await fetch(`${api}/api/nutrition/meal-plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20000),
    });
    const body = await meal.json().catch(() => ({}));
    const meals = Array.isArray(body.meals) ? body.meals.length : 0;
    if (meal.ok && meals > 0) pass('Meal plan generate', `${meals} meals`);
    else failCheck('Meal plan generate', `status=${meal.status} meals=${meals}`);
  } catch (e) {
    failCheck('Meal plan generate', e instanceof Error ? e.message : String(e));
  }

  try {
    const regen = await fetch(`${api}/api/training/programs/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000001' }),
      signal: AbortSignal.timeout(20000),
    });
    // Fast failure (profile not found) is healthy; hang/timeout is not.
    if (regen.status > 0 && regen.status < 600) {
      pass('Regenerate responds quickly', String(regen.status));
    } else failCheck('Regenerate responds quickly', String(regen.status));
  } catch (e) {
    failCheck('Regenerate responds quickly', e instanceof Error ? e.message : String(e));
  }
}

await smoke();

console.log(`\n=== ${fail === 0 ? 'PRE-BUILD GATE PASSED' : `PRE-BUILD GATE FAILED (${fail})`} ===`);
process.exit(fail === 0 ? 0 : 1);

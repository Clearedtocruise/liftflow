#!/usr/bin/env node
/**
 * Sprint 7.5 — AI Nutrition Intelligence validation
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

console.log('=== Sprint 7.5 Nutrition Intelligence Validation ===\n');

const requiredFiles = [
  'backend/src/lib/nutritionIntelligenceEngine.ts',
  'backend/src/lib/loadNutritionIntelligence.ts',
  'src/types/nutritionIntelligence.ts',
  'src/services/nutritionIntelligenceService.ts',
  'src/components/nutrition/NutritionIntelligenceDashboard.tsx',
  'src/app/(features)/nutrition-intelligence.tsx',
  'src/lib/nutritionIntelligenceEngine.ts',
];

for (const f of requiredFiles) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing file', f);
}

const engine = read('backend/src/lib/nutritionIntelligenceEngine.ts');
const loader = read('backend/src/lib/loadNutritionIntelligence.ts');

for (const token of [
  'computeNutritionIntelligence',
  'increase_carbs',
  'reduce_calories',
  'increase_protein',
  'hydration_reminder',
  'voiceEatTodayLine',
  'voiceGroceryLine',
  'mealSuggestions',
  'groceryList',
  'weeklyPlan',
  'hydrationMl',
  'inferWeightTrend',
  'computeNutritionAdherence',
]) {
  if (engine.includes(token)) pass('Engine', token);
  else fail('Engine missing', token);
}

if (loader.includes('loadRecoveryIntelligence') && loader.includes('body_composition_records')) {
  pass('Loader uses recovery + weight trend');
} else fail('Loader data wiring');

if (loader.includes('planned_workouts') && loader.includes('workout_sessions')) {
  pass('Loader uses workout volume + upcoming workout');
} else fail('Loader workout context');

if (loader.includes('meals') && loader.includes('hydration_logs')) {
  pass('Loader uses intake + adherence');
} else fail('Loader intake/adherence');

const route = read('backend/src/routes/nutrition.ts');
if (route.includes('/intelligence') && route.includes('loadNutritionIntelligence')) pass('API route');
else fail('API route');

const voice = read('src/lib/voice/parseVoiceCommand.ts');
if (voice.includes('nutrition_query') && voice.includes('grocery_list_query')) pass('Voice intents');
else fail('Voice intents');

const nutritionTab = read('src/app/(tabs)/nutrition.tsx');
if (nutritionTab.includes('nutritionIntelligenceService') && nutritionTab.includes('nutrition_query')) {
  pass('Nutrition tab voice wiring');
} else fail('Nutrition tab voice wiring');

const coaching = read('src/app/(tabs)/coaching.tsx');
if (coaching.includes('NutritionIntelligenceDashboard') && coaching.includes('nutritionIntelligenceService')) {
  pass('Coaching tab integration');
} else fail('Coaching tab integration');

const panel = read('src/components/nutrition/NutritionIntelligenceDashboard.tsx');
if (panel.includes('coachingTips') && panel.includes('groceryList') && panel.includes('weeklyPlan')) {
  pass('Nutrition intelligence UI');
} else fail('Nutrition intelligence UI');

const types = read('src/types/nutritionIntelligence.ts');
for (const input of ['recoveryScore', 'trainingVolume7d', 'weightTrend', 'adherencePct', 'upcomingWorkout']) {
  if (types.includes(input)) pass('Input factor', input);
  else fail('Input factor missing', input);
}

console.log('\n--- Unit tests ---');
const unit = spawnSync('node', ['scripts/test-nutrition-intelligence.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(unit.stdout ?? '');
if (unit.stderr) process.stderr.write(unit.stderr);
if (unit.status === 0) pass('Unit tests — all passed');
else fail('Unit tests');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.5 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

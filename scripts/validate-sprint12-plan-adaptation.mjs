#!/usr/bin/env node
/**
 * Sprint 12 — Plan adaptation (move workout → nutrition sync → home banner)
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

console.log('=== Sprint 12 Plan Adaptation (Phase 1: Move) ===\n');

for (const file of [
  'backend/src/lib/planAdaptationEngine.ts',
  'backend/src/lib/nutritionDaySync.ts',
  'src/types/planAdaptation.ts',
  'src/contexts/PlanAdjustmentContext.tsx',
  'src/components/dashboard/HomePlanAdjustedBanner.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const engine = read('backend/src/lib/planAdaptationEngine.ts');
const nutrition = read('backend/src/lib/nutritionDaySync.ts');
const route = read('backend/src/routes/training.ts');
const calendar = read('src/components/program/WorkoutCalendar.tsx');
const training = read('src/services/trainingService.ts');
const api = read('src/api/client.ts');
const dashboard = read('src/app/(tabs)/dashboard.tsx');
const banner = read('src/components/dashboard/HomePlanAdjustedBanner.tsx');

record('Plan adaptation engine exports applyScheduleChange', engine.includes('export async function applyScheduleChange'));
record('Move triggers nutrition sync for affected dates', engine.includes('syncNutritionForDates'));
record('Auto-swap when destination occupied', engine.includes('swappedWith'));
record('Coach Plan Adjusted messages', engine.includes("headline: 'Plan Adjusted'"));
record('Nutrition day sync preserves modified meals', nutrition.includes("status !== 'planned'"));
record('Training day pre/post workout meals', nutrition.includes('pre_workout'));
record('Rest day removes planned pre/post meals', nutrition.includes('mealsRemoved'));
record('POST /api/training/plan/adapt route', route.includes("trainingRouter.post('/plan/adapt'"));
record('Calendar uses adaptScheduleChange', calendar.includes('adaptScheduleChange'));
record('Client adaptScheduleChange API', api.includes('adaptScheduleChange'));
record('Training service adaptScheduleChange', training.includes('adaptScheduleChange'));
record('Plan adjustment context provider', read('src/state/AppProviders.tsx').includes('PlanAdjustmentProvider'));
record('Skip workout marks cancelled + recovery nutrition', engine.includes("type: 'skip'") && engine.includes('userSkipped'));
record('Swap exchanges two planned workouts', engine.includes("type: 'swap'") && engine.includes('applySwap'));
record('Volume redistribution after skip', engine.includes('redistributeVolumeAfterSkip'));
record('Route accepts swap and skip', route.includes("change.type === 'swap'") && route.includes("change.type === 'skip'"));
record('Calendar skip and swap actions', calendar.includes("'Skip'") && calendar.includes('Swap days'));

record('Home Plan Adjusted banner', banner.includes('Plan Adjusted') || banner.includes('adjustment.headline'));
record('Dashboard shows banner + reloads on adjustment', dashboard.includes('HomePlanAdjustedBanner') && dashboard.includes('usePlanAdjustment'));

console.log('\nPhase 2: swap + skip · Phase 1: move');
const pass = checks.filter((c) => c.pass).length;
console.log(`\nSummary: ${pass}/${checks.length} checks`);
if (pass !== checks.length) process.exit(1);

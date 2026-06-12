#!/usr/bin/env node
/**
 * Sprint 5 — Nutrition calculation audit validation
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

console.log('=== Sprint 5 Nutrition Calculation Audit ===\n');

for (const file of [
  'src/lib/mealAggregation.ts',
  'src/lib/mealCleanup.ts',
  'backend/src/lib/mealAggregation.ts',
  'backend/src/lib/mealCleanup.ts',
  'docs/SPRINT5_NUTRITION_AUDIT_REPORT.md',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const clientAgg = read('src/lib/mealAggregation.ts');
const backendAgg = read('backend/src/lib/mealAggregation.ts');
const loader = read('backend/src/lib/loadNutritionIntelligence.ts');

for (const token of ['aggregateWeeklyMeals', 'countNutritionLogDays', 'isConsumedMeal', 'dedupeMealsByType']) {
  record(`Client aggregation: ${token}`, clientAgg.includes(token));
  record(`Backend aggregation: ${token}`, backendAgg.includes(token));
}

record(
  'Intelligence loader uses aggregateDailyMeals',
  loader.includes('aggregateDailyMeals(todayMeals)') && loader.includes('countNutritionLogDays'),
);

record(
  'Intelligence loader removed raw meal sum loop',
  !loader.includes('for (const meal of todayMealsRes.data'),
);

record(
  'Nutrition tab shows week totals',
  read('src/app/(tabs)/nutrition/index.tsx').includes('Week totals') &&
    read('src/app/(tabs)/nutrition/index.tsx').includes('aggregateWeeklyMeals'),
);

record(
  'Dashboard uses aggregateDailyMeals',
  read('src/app/(tabs)/dashboard.tsx').includes('aggregateDailyMeals'),
);

record(
  'getDailySummary uses aggregateDailyMeals',
  read('src/services/nutritionService.ts').includes('aggregateDailyMeals(meals)'),
);

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testRun = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/mealAggregation.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (backend mealAggregation)',
  testRun.status === 0,
  testRun.status === 0 ? '5/5' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 120),
);

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

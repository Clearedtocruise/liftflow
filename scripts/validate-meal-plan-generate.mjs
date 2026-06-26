#!/usr/bin/env node
/**
 * Meal plan generation regression gate — run before TestFlight builds.
 * Validates week alignment logic, API contract, and client save path.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadRootEnv();
const api = (env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com').replace(/\/$/, '');

const VALID_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']);

function addCalendarDays(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekDatesFromStart(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
}

function remapApiMealsToClientWeek(meals, apiWeekStart, clientWeekStart) {
  if (apiWeekStart === clientWeekStart) return meals;
  const apiDates = weekDatesFromStart(apiWeekStart);
  const clientDates = weekDatesFromStart(clientWeekStart);
  return meals.map((meal) => {
    const dateKey = meal.scheduledDate.slice(0, 10);
    const dayIndex = apiDates.indexOf(dateKey);
    if (dayIndex < 0) return meal;
    return { ...meal, scheduledDate: clientDates[dayIndex] };
  });
}

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  return ok;
}

let fail = 0;
function record(name, ok, detail = '') {
  if (!check(name, ok, detail)) fail += 1;
}

console.log('=== Meal Plan Generation Validation ===\n');

// --- Week remap unit tests ---
const sampleMeals = [
  { mealType: 'breakfast', name: 'Test', scheduledDate: '2026-06-15' },
  { mealType: 'lunch', name: 'Test', scheduledDate: '2026-06-16' },
];
const remapped = remapApiMealsToClientWeek(sampleMeals, '2026-06-15', '2026-06-08');
record(
  'Week remap shifts by day index',
  remapped[0]?.scheduledDate === '2026-06-08' && remapped[1]?.scheduledDate === '2026-06-09',
  `got ${remapped.map((m) => m.scheduledDate).join(', ')}`,
);
const unchanged = remapApiMealsToClientWeek(sampleMeals, '2026-06-15', '2026-06-15');
record('Week remap no-op when weeks match', unchanged[0]?.scheduledDate === '2026-06-15');

// --- Source checks ---
const serviceSrc = fs.readFileSync(path.join(root, 'src/services/nutritionService.ts'), 'utf8');
const nutritionSrc = fs.readFileSync(path.join(root, 'src/app/(tabs)/nutrition/index.tsx'), 'utf8');
record('Service uses week align helper', serviceSrc.includes('remapApiMealsToClientWeek'));
record('Service passes client week to DB', serviceSrc.includes('clientWeekStart'));
record('Service checks insert errors', serviceSrc.includes('insertError'));
record('Service verifies saved meals', serviceSrc.includes('getMealsForWeek(userId, clientWeekStart'));
record('Service uses resolveTimeZone', serviceSrc.includes('resolveTimeZone'));
record('Nutrition passes resolved timezone', nutritionSrc.includes('resolveTimeZone(user.timezone)'));
record('Nutrition single generate button', (nutritionSrc.match(/Generate Weekly Meal Plan/g) ?? []).length === 1);
record('Nutrition generate deep link', nutritionSrc.includes("generate !== '1'"));
record('Home generate meal plan wired', fs.readFileSync(path.join(root, 'src/app/(tabs)/dashboard.tsx'), 'utf8').includes('nutrition?generate=1'));
record('Prefetch has timeouts', fs.readFileSync(path.join(root, 'src/lib/planDataPrefetch.ts'), 'utf8').includes('withTimeout'));
record('Dashboard cache-first load', fs.readFileSync(path.join(root, 'src/app/(tabs)/dashboard.tsx'), 'utf8').includes('planDataCache.readWeek'));

record('Backend rotates weekly meals', fs.readFileSync(path.join(root, 'backend/src/lib/mealPlanTemplates.ts'), 'utf8').includes('pickFromPool'));
record('Weekly generator uses day index', fs.readFileSync(path.join(root, 'backend/src/lib/aiCoach.ts'), 'utf8').includes('generateWeeklyMealPlanMeals'));
const programEngineSrc = fs.readFileSync(path.join(root, 'backend/src/lib/programEngine.ts'), 'utf8');
record(
  'Program varies exercises per calendar day',
  programEngineSrc.includes('rotationSeed = (week - 1) * 7 + slot.dayIndex') &&
    programEngineSrc.includes('dayIndex: slot.dayIndex'),
);
const planRulesMatch = programEngineSrc.match(/PLAN_RULES_VERSION\s*=\s*(\d+)/);
const planRulesVersion = planRulesMatch ? Number(planRulesMatch[1]) : 0;
record(
  'PLAN_RULES_VERSION bumped for regen',
  planRulesVersion >= 5 &&
    programEngineSrc.includes('meta.planRulesVersion === PLAN_RULES_VERSION'),
  planRulesVersion ? `v${planRulesVersion}` : 'missing',
);
try {
  const res = await fetch(`${api}/api/nutrition/meal-plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000001' }),
  });
  record('Meal plan API responds', res.ok, `status ${res.status}`);
  const plan = await res.json();
  const meals = plan.meals ?? [];
  record('API returns 42 meals (7 days × 6)', meals.length === 42, `count=${meals.length}`);
  record('API includes weekStartDate', typeof plan.weekStartDate === 'string' && plan.weekStartDate.length === 10);
  const badTypes = meals.filter((m) => !VALID_TYPES.has(m.mealType));
  record('All meal types valid enum', badTypes.length === 0, badTypes[0]?.mealType ?? 'ok');
  const dates = [...new Set(meals.map((m) => m.scheduledDate.slice(0, 10)))].sort();
  record('API spans 7 distinct dates', dates.length === 7, `dates=${dates.length}`);
  const breakfasts = meals.filter((m) => m.mealType === 'breakfast').map((m) => m.name);
  const uniqueBreakfasts = new Set(breakfasts);
  const localRotates = fs.readFileSync(path.join(root, 'backend/src/lib/mealPlanTemplates.ts'), 'utf8').includes('pickFromPool');
  const liveRotates = uniqueBreakfasts.size > 1;
  check(
    'Production API rotates breakfast (live)',
    liveRotates,
    liveRotates ? 'ok' : `unique=${uniqueBreakfasts.size} — push backend + redeploy Render`,
  );
  record('Backend meal rotation source ready', localRotates);
} catch (error) {
  record('Meal plan API reachable', false, error instanceof Error ? error.message : String(error));
}

console.log(`\nMeal plan validation: ${fail === 0 ? 'PASS' : 'FAIL'} (${fail} failed)\n`);
if (fail > 0) process.exit(1);

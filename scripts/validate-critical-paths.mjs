#!/usr/bin/env node
/**
 * Blocks TestFlight builds when perf refactors drop required user flows.
 * Static source checks — fast, no network.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** @type {{ file: string, label: string, patterns: string[] }[]} */
const REQUIRED = [
  {
    file: 'src/app/(tabs)/nutrition/index.tsx',
    label: 'Nutrition tab meal plan',
    patterns: [
      'ensureWeekMealCoverage',
      'generateWeeklyMealPlan',
      'ensureMealPlan',
      'pruneDuplicateMeals',
    ],
  },
  {
    file: 'src/contexts/AuthContext.tsx',
    label: 'Auth startup prefetch',
    patterns: ['warmWeekPlanData', 'loadProfile', 'setIsLoading(false)'],
  },
  {
    file: 'src/lib/planDataPrefetch.ts',
    label: 'Week plan warm cache',
    patterns: ['getMealsForWeek', 'getPlannedWorkouts', 'writeMeals'],
  },
  {
    file: 'src/services/nutritionService.ts',
    label: 'Nutrition service generate',
    patterns: ['ensureWeekMealCoverage', 'generateWeeklyMealPlan', 'removePlannedMealsForWeek'],
  },
  {
    file: 'src/app/(tabs)/dashboard.tsx',
    label: 'Dashboard plan load',
    patterns: ['awaitWarmWeekPlanData', 'getPlannedWorkouts', 'getMealsForWeek'],
  },
];

let fail = 0;

for (const { file, label, patterns } of REQUIRED) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`  FAIL — ${label} — missing file ${file}`);
    fail += 1;
    continue;
  }
  const src = read(file);
  const missing = patterns.filter((p) => !src.includes(p));
  if (missing.length === 0) {
    console.log(`  PASS — ${label}`);
  } else {
    console.log(`  FAIL — ${label} — missing: ${missing.join(', ')}`);
    fail += 1;
  }
}

if (fail > 0) {
  console.error(`\nCritical path validation failed (${fail} check(s)).`);
  process.exit(1);
}

console.log(`\nCritical paths: PASS (${REQUIRED.length}/${REQUIRED.length})`);

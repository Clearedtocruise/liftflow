#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1;
  else fail += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Workout Assignment + Daily Rollover Hotfix ===\n');

check('activeTrainingDay module', fs.existsSync('src/lib/activeTrainingDay.ts'));
check('useLocalDayRollover hook', fs.existsSync('src/hooks/useLocalDayRollover.ts'));
check('backend localDate', fs.existsSync('backend/src/lib/localDate.ts'));

const active = read('src/lib/activeTrainingDay.ts');
check('resolveActiveTrainingDay', active.includes('export function resolveActiveTrainingDay'));
check('resolveCoachTrainingGuidance', active.includes('export function resolveCoachTrainingGuidance'));
check('coerceTrainingRecommendationForSchedule', active.includes('coerceTrainingRecommendationForSchedule'));

const dashboard = read('src/app/(tabs)/dashboard.tsx');
check('Dashboard uses activeTrainingDay', dashboard.includes('resolveActiveTrainingDay'));
check('Dashboard day rollover', dashboard.includes('useLocalDayRollover'));

const workout = read('src/app/(tabs)/workout/index.tsx');
check('Workout tab timezone today', workout.includes('localDateString(new Date(), user?.timezone)'));
check('Workout tab buildWeekPlan TZ', workout.includes('buildWeekPlan(result.success ? result.data : [], new Date(), user?.timezone)'));

const nutrition = read('src/app/(tabs)/nutrition/index.tsx');
check('Nutrition uses activeTrainingDay', nutrition.includes('resolveActiveTrainingDay'));
check('Nutrition getWeekRange TZ', nutrition.includes('getWeekRange(new Date(), user.timezone)'));

const engine = read('backend/src/lib/workoutRecommendationEngine.ts');
check('Engine coerce schedule', engine.includes('coerceTrainingRecommendationForSchedule'));
check('Scheduled workout wins over rest_day', engine.includes('!hasScheduledWorkout'));

const programTypes = read('backend/src/lib/programTypes.ts');
check('Upper focus spacing', programTypes.includes('enforceUpperFocusSpacing'));

const prescription = read('backend/src/lib/exerciseCoachPrescription.ts');
check('Coach respects train_light copy', prescription.includes("trainingRecommendation === 'train_light'"));

console.log(`\nSummary: ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);

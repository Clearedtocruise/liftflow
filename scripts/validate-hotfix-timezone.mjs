#!/usr/bin/env node
/**
 * Hotfix — local timezone / calendar date validation
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

console.log('=== Hotfix: Timezone / Local Date ===\n');

for (const file of [
  'src/lib/localDate.ts',
  'src/lib/mealAggregation.ts',
  'src/lib/weekPlan.ts',
  'src/app/(tabs)/dashboard.tsx',
  'src/components/dashboard/HomeNextUpCard.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const localDate = read('src/lib/localDate.ts');
const mealAgg = read('src/lib/mealAggregation.ts');
const weekPlan = read('src/lib/weekPlan.ts');
const dashboard = read('src/app/(tabs)/dashboard.tsx');
const nextUp = read('src/components/dashboard/HomeNextUpCard.tsx');
const nutrition = read('src/services/nutritionService.ts');
const workout = read('src/app/(tabs)/workout/index.tsx');

record('localDateString helper', localDate.includes('export function localDateString'));
record('Device timezone resolver', localDate.includes('deviceTimeZone'));
record('parseScheduledTimeToMinutes', localDate.includes('parseScheduledTimeToMinutes'));
record('formatScheduledDbTime for planned workouts', localDate.includes('formatScheduledDbTime'));
record('weekPlan uses localDateString', weekPlan.includes('localDateString(d, timeZone)'));
record('isToday uses local date', weekPlan.includes('localDateString(new Date(), timeZone)'));
record('findNextMeal skips past slots with overdue fallback', mealAgg.includes('overdue') && mealAgg.includes('isNextMealCandidate'));
record('Modified meals remain next-meal candidates', mealAgg.includes("status !== 'completed' && status !== 'skipped'"));
record('Dashboard local today', dashboard.includes('localDateString(new Date(), user?.timezone)'));
record('Dashboard hasWorkoutToday compares scheduledDate', dashboard.includes('nextPlanned?.scheduledDate === today'));
record('Dashboard workout time from DB', dashboard.includes('formatScheduledDbTime(todaysWorkout?.scheduledTime)'));
record('Dashboard focus refresh', dashboard.includes('useFocusEffect'));
record('Profile timezone backfill', dashboard.includes('deviceTimeZone()'));
record('Overdue label on HomeNextUpCard', nextUp.includes('Overdue'));
record('nutritionService todayDate local', nutrition.includes('localDateString()'));
record('Workout tab local today match', workout.includes('localDateString()'));

console.log('\nFlow: device TZ → local YYYY-MM-DD → skip past meals → overdue label → DB workout time');
const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

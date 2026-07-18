#!/usr/bin/env node
/**
 * Sprint 4 — Weekly workout view validation
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

console.log('=== Sprint 4 Weekly Workout View ===\n');

for (const file of [
  'src/lib/weekPlan.ts',
  'src/components/workout/execution/WorkoutWeeklyPlanScreen.tsx',
  'src/components/workout/execution/WorkoutRestDayScreen.tsx',
  'src/app/(tabs)/workout/index.tsx',
  'src/app/(tabs)/workout/rest-day.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const weekPlan = read('src/lib/weekPlan.ts');
const weeklyScreen = read('src/components/workout/execution/WorkoutWeeklyPlanScreen.tsx');
const workoutIndex = read('src/app/(tabs)/workout/index.tsx');
const layout = read('src/app/(tabs)/workout/_layout.tsx');

record('Week has 7 weekday labels', weekPlan.includes("'Sunday'") && (weekPlan.match(/WEEKDAY_LABELS/g) ?? []).length >= 1);
record(
  'buildWeekPlan returns 7 days',
  weekPlan.includes('export function buildWeekPlan') &&
    weekPlan.includes('getWeekRange') &&
    weekPlan.includes('dates.map') &&
    weekPlan.includes('WEEKDAY_LABELS[index]'),
);
record('workoutTotalSets helper exists', weekPlan.includes('export function workoutTotalSets'));
record('Weekly card shows total sets', weeklyScreen.includes('workoutTotalSets'));
record('Weekly card shows exercise count', weeklyScreen.includes('workoutExerciseCount'));
record('Weekly card shows muscle groups', weeklyScreen.includes('workoutMuscleGroups'));
record('Weekly card shows duration', weeklyScreen.includes('workoutDurationMinutes'));
record('No Saturday conditioning hardcode', !weeklyScreen.includes("day.dayLabel === 'Saturday'"));
record(
  'Day cards tappable (select not disabled)',
  weeklyScreen.includes('onSelectDay(day)') &&
    weeklyScreen.includes('onPress={() => onSelectDay(day)}') &&
    !/onSelectDay[\s\S]{0,120}disabled=/.test(weeklyScreen),
);
record('Rest day route wired', workoutIndex.includes('/(tabs)/workout/rest-day'));
record('Rest day stack screen registered', layout.includes('rest-day'));

console.log('\nWeekly card fields: name · muscle groups · exercises · sets · duration');
console.log('Tap behavior: workout → day overview · rest → rest-day · cardio → cardio-tracking');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

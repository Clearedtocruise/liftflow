#!/usr/bin/env node
/**
 * Preflight for workout day controls + muscle map hotfix (Build 211+).
 */
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

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

/** A renamed/removed file must fail its own check, not crash the whole preflight. */
function read(rel) {
  if (!exists(rel)) return '';
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Workout Day + Muscle Map Hotfix ===\n');

const required = [
  'src/lib/planDayActions.ts',
  'src/constants/muscles.ts',
  'src/lib/exerciseMuscleMap.ts',
  'src/components/exercise/anatomy/MuscleMapFigure.tsx',
  'src/components/exercise/ExerciseMusclePanel.tsx',
];

for (const file of required) check(`File exists: ${file}`, exists(file));

check('react-native-body-highlighter dependency', read('package.json').includes('react-native-body-highlighter'));

const planActions = read('src/lib/planDayActions.ts');
check('Home manage day menu', planActions.includes('showHomeManageDayMenu'));
check('Weekly edit day menu', planActions.includes('showWeeklyEditDayMenu'));

// The home hero replaced HomeNextUpCard; move/swap must still have an entry point there.
const hero = read('src/components/dashboard/TodayHeroCard.tsx');
const dashboard = read('src/app/(tabs)/dashboard.tsx');
check(
  'Home move/swap day entry point',
  hero.includes('onManageDay') &&
    hero.includes('Move or Swap Day') &&
    dashboard.includes('buildHomeManageDayMenu') &&
    dashboard.includes('ManageDayModal'),
);

const weekly = read('src/components/workout/execution/WorkoutWeeklyPlanScreen.tsx');
check('Weekly Edit Day button', /label="Edit day"/i.test(weekly) && weekly.includes('onEditDay'));
check('Loading skeleton (no false rest days)', weekly.includes('Loading weekly plan') && weekly.includes('!loading'));

const muscleMap = read('src/lib/exerciseMuscleMap.ts');
check('Catalog muscle profiles', muscleMap.includes('EXERCISE_MUSCLE_PROFILES'));
check('Exercise name fallback', muscleMap.includes('deriveFromNamePattern'));

const figure = read('src/components/exercise/anatomy/MuscleMapFigure.tsx');
check('Muscle map error boundary', figure.includes('MuscleMapErrorBoundary'));

const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
check('Active session muscle panel', active.includes('ExerciseMusclePanel'));

const overview = read('src/components/workout/execution/WorkoutDayOverviewScreen.tsx');
check('Day overview muscle panel', overview.includes('ExerciseMusclePanel'));

const list = read('src/components/workout/execution/WorkoutExerciseDetailList.tsx');
const weekPlan = read('src/lib/weekPlan.ts');
check('Per-exercise inline muscle map', list.includes('variant="inline"'));
check('Dedupe planned workouts by date', weekPlan.includes('dedupePlannedWorkoutsByDate'));
check('Weekly plan entries for manage day', weekPlan.includes('buildWeeklyPlanEntries'));
check('Plan day debug logging', exists('src/lib/planDayDebug.ts'));
check('Manage day uses weekly plan entries', planActions.includes('buildWeeklyPlanEntries'));

console.log(`\nSummary: ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);

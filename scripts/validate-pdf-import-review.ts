/**
 * Guard: an imported PDF plan is reviewable and editable before it goes live, day names can be
 * changed everywhere they exist, and workout history still tracks the sessions it produces.
 *
 * The importer used to commit the parser's output verbatim, so a misread rep range or a day the
 * parser named "Day 3" instead of "Pull" could only be corrected after the plan was already the
 * user's active program. These checks pin the review step, the single day editor both program
 * screens share, and the fact that renaming a day never rewrites a completed workout.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setDayLabel, toggleRestDay } from '@/lib/programCycleEditor';
import {
  addMeal,
  describeImportDraft,
  importDraftIssue,
  importDraftToPreview,
  previewToImportDraft,
  removeMeal,
  setNutritionDayLabel,
  setWorkoutDays,
  stripDayOrdinal,
  updateMeal,
} from '@/lib/programImportDraft';
import type { ProgramImportPreview } from '@/types/programImport';

const repoRoot = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

const importScreen = source('src/app/(features)/import-program.tsx');
const customProgram = source('src/app/(features)/custom-program.tsx');
const dayEditor = source('src/components/program/CycleDayEditor.tsx');
const nutritionEditor = source('src/components/program/NutritionPlanEditor.tsx');
const workoutService = source('src/services/workoutService.ts');
const cycleService = source('backend/src/lib/programCycleService.ts');
const cycleLib = source('backend/src/lib/programCycle.ts');

console.log('Upload, then review, then follow');
check(
  'the import screen renders a review step once a plan has been read',
  importScreen.includes('previewToImportDraft(') && importScreen.includes('Review your plan'),
  true,
);
check(
  'commit sends the edited draft rather than the raw parse',
  /commitProgramImport\(\{[\s\S]{0,200}preview: importDraftToPreview\(draft, parsed\)/.test(importScreen),
  true,
);
check(
  'the raw parse is kept so warnings and page count still reach the server',
  importScreen.includes('setParsed(result.data)') && importScreen.includes('importDraftToPreview(draft, parsed)'),
  true,
);
check(
  'reading a plan no longer commits straight from the preview card',
  /preview: preview\b/.test(importScreen),
  false,
);
check('a review can be thrown away and started again', importScreen.includes('Start over'), true);
check(
  'a draft that is not ready blocks the follow button instead of failing on the server',
  importScreen.includes('disabled={busy || Boolean(issue)}'),
  true,
);

console.log('\nWorkout days are editable in review');
check('days are edited through the shared day editor', importScreen.includes('<CycleDayEditor'), true);
check('exercises can be added during review', importScreen.includes('ExercisePickerModal'), true);
check('the cycle length can be changed during review', importScreen.includes('setCycleLength('), true);
for (const helper of ['setDayLabel', 'toggleRestDay', 'updateExerciseField', 'moveExercise', 'removeExercise']) {
  check(`review reuses the program editor's ${helper}`, importScreen.includes(`${helper}(`), true);
}

console.log('\nNutrition is editable in review');
check('nutrition renders its own editor', importScreen.includes('<NutritionPlanEditor'), true);
check('daily targets are editable', nutritionEditor.includes('onGoalChange'), true);
check('individual meals are editable', nutritionEditor.includes('onMealChange'), true);
check('meals can be added and removed', nutritionEditor.includes('onAddMeal') && nutritionEditor.includes('onRemoveMeal'), true);
check('a goals-only import says so rather than showing an empty list', nutritionEditor.includes('only the daily targets above'), true);

console.log('\nDay names can be changed wherever a day exists');
check('both program screens use one day editor', importScreen.includes('CycleDayEditor') && customProgram.includes('CycleDayEditor'), true);
check(
  'the name field is not hidden behind the workout-day branch, so rest days can be named too',
  dayEditor.indexOf('accessibilityLabel={`Name for day') < dayEditor.indexOf('day.isRest ? ('),
  true,
);
check('a nutrition day can be named as well', nutritionEditor.includes('onDayLabelChange'), true);
check(
  'a renamed day reaches upcoming workouts, because editing bumps the cycle version',
  cycleService.includes('version: existing.version + 1') && cycleService.includes('materializeUpcomingCycleDays(db, userId, program.id, nextCycle, today)'),
  true,
);
check(
  'the rematerialized row carries the new name and version',
  cycleService.includes('dayLabel: day.label') && cycleService.includes('cycleVersion: cycle.version'),
  true,
);
check('the day name is what titles the materialized workout', cycleService.includes('cycleWorkoutName(day.label, dayNumber)'), true);

console.log('\nHistory still tracks an imported workout');
check(
  'a session records the planned workout it came from',
  workoutService.includes('planned_workout_id: payload.plannedWorkoutId'),
  true,
);
check(
  "the session snapshots the day's name at the time it was started",
  workoutService.includes('name: payload.name || planned.name'),
  true,
);
check(
  'history reads completed sessions directly, so it never depends on the current day name',
  /from\('workout_sessions'\)[\s\S]{0,300}eq\('status', 'completed'\)/.test(workoutService),
  true,
);
check(
  'a started or completed day is never re-materialized out from under history',
  /\['completed', 'active', 'in_progress', 'paused'\]/.test(cycleService) ||
    /\['completed', 'active', 'in_progress', 'paused'\]/.test(cycleLib),
  true,
);

console.log('\nTabata survives the trip from PDF to session');
const parseLib = source('backend/src/lib/pdfProgramParse.ts');
const editorLib = source('src/lib/programCycleEditor.ts');
const planLib = source('src/lib/workoutPlan.ts');
const activeWorkout = source('src/components/workout/execution/ActiveWorkoutScreen.tsx');

check('the parser looks for a named protocol', parseLib.includes('detectExecutionHint'), true);
check(
  'the LLM is asked for the day mode and its interval timing',
  /executionMode is how the day is run/.test(parseLib) && /intervalWorkSeconds, intervalRestSeconds and intervalRounds/.test(parseLib),
  true,
);
check('a day can declare how it is run', cycleLib.includes('executionMode?: string;') && cycleLib.includes('isIntervalCycleMode'), true);
check(
  'the day mode is materialized onto the planned workout, which is what the session reads',
  cycleService.includes('executionMode: day.executionMode'),
  true,
);
check(
  "the day's interval timing is materialized with it",
  cycleService.includes('intervalWorkSeconds: day.intervalWorkSeconds') &&
    cycleService.includes('intervalRounds: day.intervalRounds'),
  true,
);
check(
  'the session reads the plan mode as the default for every exercise',
  planLib.includes("normalizeExecutionMode(workout?.metadata?.executionMode)"),
  true,
);
check(
  "the plan's own work/rest/rounds beat the mode defaults",
  /workSeconds: positive\(input\.intervalWorkSeconds\) \?\? defaults\.workSeconds/.test(
    source('src/lib/workoutExecutionMode.ts'),
  ),
  true,
);
// Seeded from the prop rather than the aligned `planExercises`, which is declared below this
// hook: a useState initialiser runs on the first render, so reading that const handed the helper
// undefined and every workout start died on the `.find` inside it.
check(
  'the session Tabata clock opens on what the plan asked for',
  activeWorkout.includes('tabataConfigFromPlan(planExercisesProp, clampIntervalRounds)'),
  true,
);
check('the day mode is editable, not only parsed', dayEditor.includes('onModeChange'), true);
check('interval timings are editable on an interval day', dayEditor.includes('onIntervalChange'), true);
check(
  'both program screens expose the mode picker',
  importScreen.includes('onModeChange') && customProgram.includes('onModeChange'),
  true,
);

console.log('\nThe editor stops erasing what it cannot show');
for (const field of ['restSeconds', 'executionMode', 'supersetGroupId']) {
  check(
    `an edit preserves ${field}`,
    new RegExp(`${field}: exercise\\.${field}`).test(editorLib) && new RegExp(`${field}: ex\\.${field}`).test(editorLib),
    true,
  );
}

console.log('\nThe draft model itself');
const parsed: ProgramImportPreview = {
  kind: 'both',
  title: 'Imported',
  summary: 'from pdf',
  workout: {
    lengthDays: 2,
    days: [
      { label: 'Day 1 — Push', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, repRange: '6-8' }] },
      { label: 'Day 2', isRest: false, exercises: [{ name: 'Barbell Row', sets: 4, repRange: '8' }] },
    ],
  },
  nutrition: {
    goals: { calories: 2200 },
    days: [{ dayIndex: 0, meals: [{ mealType: 'breakfast', name: 'Oats', calories: 400 }] }],
  },
  warnings: ['Parsed without AI — review carefully'],
};

check('the repeated day ordinal is stripped out of the name field', stripDayOrdinal('Day 1 — Push'), 'Push');

let draft = previewToImportDraft(parsed);
check('a parsed plan opens as an editable draft', draft.workout?.days.length, 2);
check('a parsed nutrition day falls back to the weekday it lands on', draft.nutrition?.days[0]?.label, 'Monday');

draft = setWorkoutDays(draft, setDayLabel(draft.workout!.days, 0, 'Chest'));
draft = setNutritionDayLabel(draft, 0, 'Training day');
draft = updateMeal(draft, 0, 0, { calories: 450 });
const committed = importDraftToPreview(draft, parsed);
check('a renamed workout day is what gets committed', committed.workout?.days[0]?.label, 'Chest');
check('a renamed nutrition day is what gets committed', committed.nutrition?.days[0]?.label, 'Training day');
check('an edited meal is what gets committed', committed.nutrition?.days[0]?.meals[0]?.calories, 450);
check('parser warnings survive the edit', committed.warnings, parsed.warnings);

draft = addMeal(draft, 0);
check('a blank meal is dropped rather than committed', importDraftToPreview(draft, parsed).nutrition?.days[0]?.meals.length, 1);
draft = removeMeal(draft, 0, 0);
check('a removed meal stays removed', importDraftToPreview(draft, parsed).nutrition?.days[0]?.meals.length, 0);

let restOnly = previewToImportDraft(parsed);
restOnly = setWorkoutDays(restOnly, toggleRestDay(toggleRestDay(restOnly.workout!.days, 0), 1));
check('an all-rest plan is held back instead of committed empty', Boolean(importDraftIssue(restOnly, 'both')), true);
check('the summary is recomputed from the draft', describeImportDraft(previewToImportDraft(parsed)).includes('2-day cycle'), true);

console.log(`\n${failures === 0 ? 'PDF import review: PASS' : `PDF import review: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

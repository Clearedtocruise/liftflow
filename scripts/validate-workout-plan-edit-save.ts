/**
 * Guards that edits to a day's workout are saved without starting the workout, and that a plan
 * reload cannot silently discard them.
 *
 * Usage: npm run validate:workout-plan-edit-save
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

const repoRoot = join(__dirname, '..');
function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const editRoute = source('src/app/(tabs)/workout/edit.tsx');
const editScreen = source('src/components/workout/execution/WorkoutEditScreen.tsx');
const draftContext = source('src/state/workout/WorkoutPlanDraftContext.tsx');
const draftStore = source('src/lib/workoutPlanDraftStore.ts');
const dayRoute = source('src/app/(tabs)/workout/day.tsx');
const dashboard = source('src/hooks/useTodayDashboard.ts');

console.log('\nDone writes the edits to the database');
check(
  'the edit route persists through updatePlannedWorkoutExercises',
  editRoute.includes('trainingService.updatePlannedWorkoutExercises('),
  true,
);
check(
  'Done is no longer only router.back()',
  /onDone=\{\(\)\s*=>\s*router\.back\(\)\}/.test(editRoute),
  false,
);
check('a failed save is shown rather than swallowed', editRoute.includes('setSaveError('), true);
check(
  'the screen only navigates back once the save succeeded',
  /markSaved\(result\.data\);\s*\n\s*router\.back\(\);/.test(editRoute),
  true,
);
check('a successful save rebaselines the draft', editRoute.includes('markSaved(result.data)'), true);

console.log('\nThe edit screen says whether there is anything unsaved');
check('the primary action names the save', editScreen.includes("'Save Changes' : 'Done'"), true);
check('a save in flight disables the button', editScreen.includes('loading={saving}'), true);
check('a save error is rendered', editScreen.includes('{saveError}'), true);
check('leaving with unsaved edits asks first', editScreen.includes("Alert.alert('Unsaved changes'"), true);
check('discarding is an explicit choice', editScreen.includes('onDiscard'), true);

console.log('\nA plan reload does not overwrite unsaved edits');
check(
  'the draft tracks whether it differs from the database',
  draftContext.includes('isDirty') && draftContext.includes('baselineOf('),
  true,
);
check(
  'setPlannedWorkout keeps a dirty draft for the same workout',
  draftContext.includes("if (workout.id === plannedWorkoutRef.current?.id && isDirtyRef.current) return;"),
  true,
);
check(
  'the day route no longer reseeds exercises after setPlannedWorkout',
  /setPlannedWorkout\(found\);\s*\n\s*setExercises\(/.test(dayRoute),
  false,
);
check(
  'a session plan is not mistaken for an unsaved edit',
  draftContext.includes('setSessionPlan') &&
    dayRoute.includes('setSessionPlan(sessionExercises)') &&
    dashboard.includes('setSessionPlan(result.sessionExercises)'),
  true,
);

console.log('\nBackgrounding mid-edit is not destructive');
check('the draft is written to AsyncStorage', draftStore.includes('AsyncStorage.setItem'), true);
check('a stale draft is not resurrected', draftStore.includes('MAX_AGE_MS'), true);
check('a restored draft has to belong to the workout on screen', draftContext.includes('takeRestorable'), true);
check(
  'opening another day does not clear a draft made for a different one',
  draftContext.includes("if (persistedIdRef.current === id) {"),
  true,
);
check(
  'a draft read that resolves after the plan loads is still applied',
  draftContext.includes('const current = plannedWorkoutRef.current;'),
  true,
);

console.log('\nStarting a workout carries the edits into the session');
check(
  'the day route saves a dirty draft before starting',
  /if \(isDirty\) \{[\s\S]*?updatePlannedWorkoutExercises\(/.test(dayRoute),
  true,
);
check(
  'the session is built from the saved workout, not the stale one',
  dayRoute.includes('exercisesForSessionStart(\n        planned,'),
  true,
);
check(
  'the home screen saves a dirty draft for today before starting',
  dashboard.includes('isDirty && plannedWorkout?.id === todaysWorkout.id'),
  true,
);
// The day screen has no focus refresh, so its locally loaded copy is stale the moment the edit
// screen saves. Starting from it would run the session on the pre-edit exercises.
check(
  'the day screen reads the plan the draft context holds, not its stale local copy',
  dayRoute.includes('draftWorkout?.id === loaded?.id ? (draftWorkout ?? loaded) : loaded'),
  true,
);

console.log(`\nWorkout plan edit save: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);

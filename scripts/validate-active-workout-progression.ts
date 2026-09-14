/**
 * Regression guard for the active workout progression bugs reported from TestFlight build 323:
 * pulling lifts logging distance, and a set target that climbed with every logged set so an
 * exercise could never register as complete.
 *
 * Usage: npm run validate:active-workout-progression
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyExercise } from '@/lib/exerciseClassification';
import {
  inferLoadingMethodFromHistory,
  loadingMethodToLoggingMode,
  supportedLoadingMethods,
} from '@/lib/exerciseLoadingMethod';
import { alignPlanExercisesToSession } from '@/lib/workoutPlan';
import type { Exercise, WorkoutExercise } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

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

function exercise(name: string, equipment = 'machine'): Exercise {
  return {
    id: `ex-${name}`,
    name,
    category: 'pull',
    exerciseType: 'strength',
    equipment,
    muscleGroups: ['back'],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function sessionExercise(id: string, name: string, sortOrder: number, setCount: number): WorkoutExercise {
  return {
    id,
    sessionId: 'session-1',
    exerciseId: `ex-${id}`,
    exercise: exercise(name),
    sortOrder,
    sets: Array.from({ length: setCount }, (_, index) => ({
      id: `${id}-set-${index}`,
      workoutExerciseId: id,
      setNumber: index + 1,
      type: 'normal' as const,
      loggedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

console.log('\nPulling lifts must not classify as cardio');
for (const name of [
  'Hammer Row',
  'Barbell Row',
  'Seated Cable Row',
  'Bent Over Row',
  'Upright Row',
  'Pendlay Row',
  'T-Bar Row',
]) {
  check(name, classifyExercise({ name }), 'strength');
}
check('Inverted Row', classifyExercise({ name: 'Inverted Row' }), 'bodyweight');
check('Walking Lunge', classifyExercise({ name: 'Walking Lunge' }), 'bodyweight');
check("Farmer's Walk is not cardio", classifyExercise({ name: "Farmer's Walk" }) !== 'cardio', true);

console.log('\nMachine and erg rowing stay cardio');
for (const name of ['Rowing', 'Rowing Machine', 'Row Erg', 'Rower', 'Treadmill Walk', 'Easy Run']) {
  check(name, classifyExercise({ name }), 'cardio');
}

console.log('\nA pulling lift logs weight and reps, not time and distance');
const hammerRow = exercise('Hammer Row');
check('supported loading methods', supportedLoadingMethods(hammerRow), ['external_load']);
check(
  'logging mode after a weighted history',
  loadingMethodToLoggingMode(inferLoadingMethodFromHistory(hammerRow, undefined, 60, null)),
  'weighted',
);

console.log('\nSet targets stay fixed as sets are logged');
const plan: EditableWorkoutExercise[] = [
  { id: 'p0', name: 'Wide Grip Pull Up', sets: 4, repRange: '8-10' },
  { id: 'p1', name: 'Hammer Row', sets: 4, repRange: '10-12' },
];

// "Cable Row" was swapped in for the planned "Hammer Row", so it has no plan entry of its own.
for (const loggedSets of [0, 1, 4, 6]) {
  const aligned = alignPlanExercisesToSession(plan, [
    sessionExercise('a', 'Wide Grip Pull Up', 0, 4),
    sessionExercise('b', 'Cable Row', 1, loggedSets),
  ]);
  check(`swapped-in exercise target with ${loggedSets} logged sets`, aligned[1]?.sets, 4);
}

const withAddedExercise = alignPlanExercisesToSession(plan, [
  sessionExercise('a', 'Wide Grip Pull Up', 0, 4),
  sessionExercise('b', 'Hammer Row', 1, 2),
  sessionExercise('c', 'Face Pull', 2, 5),
]);
check('planned targets survive an added exercise', [withAddedExercise[0]?.sets, withAddedExercise[1]?.sets], [4, 4]);
check('added exercise gets a stable target', withAddedExercise[2]?.sets, 3);
check('one plan entry per session exercise', withAddedExercise.length, 3);

console.log('\nAdding an exercise mid-workout says what happened');
// Reported as "adding an exercise during the workout is not working right": every failure path
// returned a bare null, and an add made mid-exercise deliberately does not move the user — so a
// rejected insert, a lift already in the session and a successful insert all looked identical.
const activeWorkoutSource = source('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const sessionContextSource = source('src/state/workout/WorkoutSessionContext.tsx');
const workoutServiceSource = source('src/services/workoutService.ts');

check(
  'the add path carries a reason instead of a bare id',
  sessionContextSource.includes('AddExerciseOutcome') && sessionContextSource.includes('alreadyInWorkout'),
  true,
);
check(
  'a failed add is reported rather than swallowed',
  activeWorkoutSource.includes("Alert.alert('Could not add exercise'"),
  true,
);
check(
  'a lift already in the session says so instead of silently doing nothing',
  /Alert\.alert\(\s*'Already in this workout'/.test(activeWorkoutSource),
  true,
);
check(
  'an add made mid-exercise confirms on screen',
  activeWorkoutSource.includes('setAddedExerciseNotice('),
  true,
);
check(
  'mid-session plan repair no longer prunes exercises the user added',
  /applySessionExercisePlan\([\s\S]{0,200}?preserveUnplanned:\s*true/.test(activeWorkoutSource),
  true,
);
check(
  'the reconciler honours preserveUnplanned before deleting anything',
  workoutServiceSource.includes('if (options?.preserveUnplanned) continue;'),
  true,
);
check(
  'a half-applied sort_order shift stops instead of inserting into an order that was never freed',
  workoutServiceSource.includes('if (shiftError) return fail(shiftError.message);'),
  true,
);

console.log('\nSwapping an exercise is not undone by plan repair');
// Reported as "tried to swap the 1st exercise, it skipped the one I swapped to and stayed on the
// old one": the plan still named the original, the repair effect read that as a dropped lift, put
// it back in the planned slot and pushed the chosen replacement to the end of the workout.
check(
  'the plan entry is rewritten to the lift the user chose',
  activeWorkoutSource.includes('setSwappedPlanNames(') && activeWorkoutSource.includes('effectivePlanExercises'),
  true,
);
check(
  'the swap is recorded before the session refresh can trigger a repair',
  /const replacedKey[\s\S]{0,600}setSwappedPlanNames\([\s\S]{0,200}await replaceExerciseByName/.test(activeWorkoutSource),
  true,
);
check(
  'repair reads the post-swap plan, not the original',
  /applySessionExercisePlan\(session\.id, user\.id, effectivePlanExercises/.test(activeWorkoutSource),
  true,
);
check(
  'a session row standing in for a planned lift is not treated as a hole',
  activeWorkoutSource.includes('if (unclaimed.length >= missing.length) return;'),
  true,
);

check(
  'a swap that keeps the original lift leaves its plan entry alone',
  activeWorkoutSource.includes('workoutExerciseId !== currentExercise.id') &&
    activeWorkoutSource.includes('forgetPlanSwap('),
  true,
);

// A swap leaves plan and session the same length with one name replaced; align must still hand out
// exactly one entry per session exercise, and the replacement inherits the planned set target.
const swapPlan: EditableWorkoutExercise[] = [
  { id: 's0', name: 'Dumbbell Bench Press', sets: 5, repRange: '5' },
  { id: 's1', name: 'Hammer Row', sets: 4, repRange: '10-12' },
];
const afterSwap = alignPlanExercisesToSession(swapPlan, [
  sessionExercise('a', 'Dumbbell Bench Press', 0, 0),
  sessionExercise('b', 'Hammer Row', 1, 0),
]);
check('a swapped-in lift inherits the planned set target', afterSwap[0]?.sets, 5);
check('the swap does not displace the rest of the plan', afterSwap[1]?.sets, 4);

console.log('\nSwaps and adds tear down the rest clock they are leaving behind');
// Next / Previous / Skip all cancel a still-counting rest before moving. focusWorkoutExercise —
// the path a swap and an add both take — did not, so the lifter landed on the exercise they had
// just chosen with the previous lift's rest still running, which blocks Log Set and the mic for
// up to a full strength rest.
const focusBody =
  /async function focusWorkoutExercise\([\s\S]*?\n  \}/.exec(activeWorkoutSource)?.[0] ?? '';
check('focusWorkoutExercise exists', focusBody.length > 0, true);
check('it clears a pending auto-advance', focusBody.includes('clearPendingExerciseAdvance()'), true);
check('it cancels a still-counting rest', focusBody.includes('cancelActiveRestTimer()'), true);
check('it invalidates a scheduled advance', focusBody.includes('advanceGenerationRef.current += 1'), true);
check(
  'the teardown runs before the session round trip, not after it',
  focusBody.indexOf('cancelActiveRestTimer()') < focusBody.indexOf('await workoutService.getSession'),
  true,
);
// An add that lands behind the current card leaves the lifter where they are, so their rest must
// keep running — only an add that actually moves them goes through focusWorkoutExercise.
check(
  'an add made mid-exercise does not move the lifter, so its rest is untouched',
  /if \(wasMidExercise\)[\s\S]{0,400}return;[\s\S]{0,200}await focusWorkoutExercise/.test(activeWorkoutSource),
  true,
);

console.log(`\n${failures === 0 ? 'Active workout progression: PASS' : `Active workout progression: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Regression guard for the active workout progression bugs reported from TestFlight build 323:
 * pulling lifts logging distance, and a set target that climbed with every logged set so an
 * exercise could never register as complete.
 *
 * Usage: npm run validate:active-workout-progression
 */
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

console.log(`\n${failures === 0 ? 'Active workout progression: PASS' : `Active workout progression: ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);

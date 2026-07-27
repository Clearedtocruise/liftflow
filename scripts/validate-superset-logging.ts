/**
 * Regression guard for supersets logging the first exercise twice.
 *
 * Root causes covered:
 * 1. Month 1 letter group ids (`ss-b`) produced no A1/A2 station labels, so the active
 *    exercise was easy to misread during a no-rest partner swap.
 * 2. A swapped-in exercise that inherited an unclaimed plan slot dropped `supersetGroupId`,
 *    dissolving the pair mid-session.
 * 3. After logging the first partner, `setCurrentIndex` only lands on the next render. A second
 *    Log Set (or watch tap) that fires after the in-flight lock clears but before that render
 *    would still close over the first workout_exercise id. The active screen now advances a
 *    `currentIndexRef` synchronously before unlocking — this script locks the helper contract
 *    that makes that advance correct.
 *
 * Usage: npx tsx scripts/validate-superset-logging.ts
 */
import { alignPlanExercisesToSession } from '@/lib/workoutPlan';
import {
  formatSupersetStationLabel,
  resolvePostSetSupersetAction,
} from '@/lib/supersetFlow';
import type { WorkoutExercise } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

function sessionExercise(
  id: string,
  name: string,
  sortOrder: number,
  setCount: number,
): WorkoutExercise {
  return {
    id,
    sessionId: 'session-1',
    exerciseId: `catalog-${id}`,
    exercise: {
      id: `catalog-${id}`,
      name,
      category: 'push',
      exerciseType: 'strength',
      equipment: 'dumbbell',
      muscleGroups: ['chest'],
      isSystem: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
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

console.log('\nStation labels for letter and numeric group ids');
check('ss-1 position 0', formatSupersetStationLabel('ss-1', 0), 'A1');
check('ss-1 position 1', formatSupersetStationLabel('ss-1', 1), 'A2');
check('ss-b position 0 (Month 1)', formatSupersetStationLabel('ss-b', 0), 'B1');
check('ss-b position 1 (Month 1)', formatSupersetStationLabel('ss-b', 1), 'B2');
check('ss-c position 0', formatSupersetStationLabel('ss-c', 0), 'C1');

console.log('\nPost-set rotation advances to the partner, not back onto the first exercise');
const plan: EditableWorkoutExercise[] = [
  { id: 'p0', name: 'Incline Dumbbell Press', sets: 3, repRange: '8-10', supersetGroupId: 'ss-b' },
  { id: 'p1', name: 'Dumbbell Lateral Raise', sets: 3, repRange: '12-15', supersetGroupId: 'ss-b' },
  { id: 'p2', name: 'Cable Fly', sets: 3, repRange: '12-15' },
];

const afterFirstA = [
  sessionExercise('we-a', 'Incline Dumbbell Press', 0, 0),
  sessionExercise('we-b', 'Dumbbell Lateral Raise', 1, 0),
  sessionExercise('we-c', 'Cable Fly', 2, 0),
];
check(
  'after A set 1 → immediate advance to B',
  resolvePostSetSupersetAction(0, plan, afterFirstA, 1),
  { skipRest: true, immediateAdvanceIndex: 1, afterRestAdvanceIndex: null },
);

const afterAThenB = [
  sessionExercise('we-a', 'Incline Dumbbell Press', 0, 1),
  sessionExercise('we-b', 'Dumbbell Lateral Raise', 1, 0),
  sessionExercise('we-c', 'Cable Fly', 2, 0),
];
check(
  'after B set 1 → rest then return to A',
  resolvePostSetSupersetAction(1, plan, afterAThenB, 1),
  { skipRest: false, immediateAdvanceIndex: null, afterRestAdvanceIndex: 0 },
);

console.log('\nIndex-ref advance contract: second log must target partner id');
/**
 * Mirrors the ActiveWorkoutScreen race window: after a successful A log the flow says advance
 * to B, the ref moves immediately, and a second log reads the ref before React re-renders.
 */
function simulateBackToBackLogs(
  session: WorkoutExercise[],
  planExercises: EditableWorkoutExercise[],
): string[] {
  const loggedTo: string[] = [];
  let currentIndex = 0;
  const currentIndexRef = { current: 0 };

  for (let tap = 0; tap < 2; tap += 1) {
    const logIndex = currentIndexRef.current;
    const exercise = session[logIndex];
    if (!exercise) break;
    loggedTo.push(exercise.id);

    const completedAfterLog = (exercise.sets?.length ?? 0) + 1;
    // Optimistic session update for the exercise just logged (refresh would do this).
    session[logIndex] = {
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          id: `${exercise.id}-new-${completedAfterLog}`,
          workoutExerciseId: exercise.id,
          setNumber: completedAfterLog,
          type: 'normal' as const,
          loggedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const action = resolvePostSetSupersetAction(logIndex, planExercises, session, completedAfterLog);
    if (action.immediateAdvanceIndex != null) {
      currentIndexRef.current = action.immediateAdvanceIndex;
      // Deliberately do NOT update `currentIndex` yet — that is the pre-render race window.
    } else if (action.afterRestAdvanceIndex != null) {
      currentIndexRef.current = action.afterRestAdvanceIndex;
      currentIndex = action.afterRestAdvanceIndex;
    }
  }

  void currentIndex;
  return loggedTo;
}

check(
  'back-to-back logs hit A then B workout_exercise ids',
  simulateBackToBackLogs(
    [
      sessionExercise('we-a', 'Incline Dumbbell Press', 0, 0),
      sessionExercise('we-b', 'Dumbbell Lateral Raise', 1, 0),
      sessionExercise('we-c', 'Cable Fly', 2, 0),
    ],
    plan,
  ),
  ['we-a', 'we-b'],
);

console.log('\nInherited plan slots keep the supersets pairing');
const swapped = alignPlanExercisesToSession(plan, [
  sessionExercise('we-a', 'Incline Dumbbell Press', 0, 0),
  sessionExercise('we-swap', 'Cable Lateral Raise', 1, 0),
  sessionExercise('we-c', 'Cable Fly', 2, 0),
]);
check('swapped partner keeps ss-b', swapped[1]?.supersetGroupId, 'ss-b');
check('swapped partner keeps set target', swapped[1]?.sets, 3);
check(
  'pair still rotates after swap',
  resolvePostSetSupersetAction(0, swapped, [
    sessionExercise('we-a', 'Incline Dumbbell Press', 0, 0),
    sessionExercise('we-swap', 'Cable Lateral Raise', 1, 0),
    sessionExercise('we-c', 'Cable Fly', 2, 0),
  ], 1).immediateAdvanceIndex,
  1,
);

console.log(
  `\n${failures === 0 ? 'Superset logging: PASS' : `Superset logging: ${failures} FAILURE(S)`}`,
);
process.exit(failures === 0 ? 0 : 1);

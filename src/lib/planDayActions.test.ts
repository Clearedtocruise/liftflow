import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEditDayMenuContent,
  buildHomeManageDayMenuContent,
  type MenuBuildInput,
} from './planDayMenu';
import { getWeekRange } from './weekPlan';
import type { ScheduleChange } from '@/types/planAdaptation';
import type { PlannedWorkout } from '@/types/training';

const reference = new Date('2026-07-29T12:00:00');
const { dates } = getWeekRange(reference);
const [day0, day1, day2] = dates;

function plannedWorkout(id: string, date: string, name: string): PlannedWorkout {
  return {
    id,
    userId: 'user-1',
    name,
    scheduledDate: date,
    status: 'planned',
    exercises: [],
  } as unknown as PlannedWorkout;
}

function input(workouts: PlannedWorkout[], changes: ScheduleChange[] = []): MenuBuildInput {
  return {
    workouts,
    reference,
    onScheduleChange: (change) => changes.push(change),
    onConfirmSkip: () => undefined,
  };
}

test('home Manage Day offers move and swap targets', () => {
  const workouts = [
    plannedWorkout('w-today', day0, 'Push Day'),
    plannedWorkout('w-other', day2, 'Leg Day'),
  ];

  const menu = buildHomeManageDayMenuContent(input(workouts), day0);
  assert.ok(menu, 'menu should build when a workout exists today');

  const actionIds = menu!.actions.map((action) => action.id);
  assert.ok(actionIds.includes('move-day'), 'move action missing');
  assert.ok(actionIds.includes('swap-workout'), 'swap action missing');

  assert.ok(menu!.swapTargets.some((target) => target.id === 'w-other'));
  assert.ok(menu!.moveTargets.some((target) => target.id === day2));
  assert.equal(menu!.focusWorkoutId, 'w-today');
});

test('Move To Tomorrow issues a move for the next calendar day', () => {
  const changes: ScheduleChange[] = [];
  const workouts = [plannedWorkout('w-today', day0, 'Push Day')];

  const menu = buildHomeManageDayMenuContent(input(workouts, changes), day0);
  menu!.actions.find((action) => action.id === 'move-tomorrow')!.onPress();

  assert.deepEqual(changes, [{ type: 'move', workoutId: 'w-today', toDate: day1 }]);
});

test('Edit Day on a planned day exposes move and swap pickers', () => {
  const workouts = [
    plannedWorkout('w-a', day0, 'Push Day'),
    plannedWorkout('w-b', day1, 'Pull Day'),
  ];

  const menu = buildEditDayMenuContent(input(workouts), day0);
  assert.ok(menu);

  const move = menu!.actions.find((action) => action.id === 'move-day');
  const swap = menu!.actions.find((action) => action.id === 'swap-workout');
  assert.equal(move?.picker, 'move');
  assert.equal(swap?.picker, 'swap');
  assert.ok(menu!.swapTargets.some((target) => target.id === 'w-b'));
});

test('Edit Day on a rest day offers exactly one Move Workout Here action', () => {
  const workouts = [plannedWorkout('w-a', day0, 'Push Day')];

  const menu = buildEditDayMenuContent(input(workouts), day1);
  assert.ok(menu);
  const moveHere = menu!.actions.filter((action) => action.picker === 'do-today');
  assert.equal(moveHere.length, 1, 'duplicate Move Workout Here buttons');
  assert.ok(menu!.doTodayTargets.some((target) => target.id === 'w-a'));
});

test('a week with only one workout can still move it to an empty day', () => {
  const workouts = [plannedWorkout('w-only', day0, 'Full Body')];
  const menu = buildHomeManageDayMenuContent(input(workouts), day0);
  assert.ok(menu);
  assert.equal(menu!.swapTargets.length, 0);
  assert.ok(menu!.moveTargets.length > 0, 'moving to an empty day must stay possible');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeWorkoutExerciseProgress,
  computeWorkoutSetProgress,
} from '@/lib/activeWorkoutMetrics';
import type { WorkoutSession } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

function exercise(id: string, sortOrder: number, loggedSets: number): WorkoutSession['exercises'][number] {
  return {
    id,
    createdAt: '2026-10-03T12:00:00.000Z',
    sessionId: 's',
    exerciseId: id,
    exercise: {
      id,
      createdAt: '2026-10-03T12:00:00.000Z',
      name: id,
      category: 'push',
      exerciseType: 'strength',
      equipment: 'barbell',
      muscleGroups: [],
      isSystem: true,
    },
    sortOrder,
    sets: Array.from({ length: loggedSets }, (_, index) => ({
      id: `${id}-${index}`,
      createdAt: '2026-10-03T12:00:00.000Z',
      workoutExerciseId: id,
      setNumber: index + 1,
      type: 'normal' as const,
      loggedAt: '2026-10-03T12:00:00.000Z',
    })),
  };
}

function plan(count: number, setsEach = 3): EditableWorkoutExercise[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e${index + 1}`,
    name: `e${index + 1}`,
    sets: setsEach,
  }));
}

test('completion counts the sets logged, not which exercise is on screen', () => {
  // Seven exercises of three sets, with three sets never logged along the way. Standing on the
  // last exercise used to read "100% complete" directly above "18 of 21 sets logged".
  const exercises = [
    exercise('e1', 0, 3),
    exercise('e2', 1, 3),
    exercise('e3', 2, 0),
    exercise('e4', 3, 3),
    exercise('e5', 4, 3),
    exercise('e6', 5, 3),
    exercise('e7', 6, 3),
  ];

  const progress = computeWorkoutSetProgress(exercises, plan(7));
  assert.equal(progress.completedSets, 18);
  assert.equal(progress.totalSets, 21);
  assert.equal(progress.percent, 86);
});

test('arriving at the last exercise is not finishing the workout', () => {
  const exercises = [exercise('e1', 0, 3), exercise('e2', 1, 0)];
  const progress = computeWorkoutSetProgress(exercises, plan(2));
  assert.equal(progress.percent, 50);

  const position = computeWorkoutExerciseProgress(1, 2);
  assert.equal(position.currentExerciseNumber, 2);
  assert.equal(position.totalExercises, 2);
});

test('every set logged reads as complete', () => {
  const exercises = [exercise('e1', 0, 3), exercise('e2', 1, 3)];
  assert.equal(computeWorkoutSetProgress(exercises, plan(2)).percent, 100);
});

test('bonus sets past the target do not push completion over 100', () => {
  const exercises = [exercise('e1', 0, 5), exercise('e2', 1, 3)];
  assert.equal(computeWorkoutSetProgress(exercises, plan(2)).percent, 100);
});

test('a lift prescribed each side is owed both sides', () => {
  // The card turns "3 sets each side" into six loggable sets. Counting the bare three here had
  // the header calling the exercise finished while the card still asked for another set.
  const exercises = [exercise('e1', 0, 3)];
  const sideplank: EditableWorkoutExercise[] = [
    { id: 'e1', name: 'e1', sets: 3, repRange: '30 sec each side' },
  ];

  const progress = computeWorkoutSetProgress(exercises, sideplank);
  assert.equal(progress.totalSets, 6);
  assert.equal(progress.completedSets, 3);
  assert.equal(progress.percent, 50);
});

test('interval rounds are the target when the plan counts rounds', () => {
  const exercises = [exercise('e1', 0, 4)];
  const tabata: EditableWorkoutExercise[] = [
    { id: 'e1', name: 'e1', sets: 3, intervalRounds: 8, executionMode: 'tabata' },
  ];

  assert.equal(computeWorkoutSetProgress(exercises, tabata).totalSets, 8);
});

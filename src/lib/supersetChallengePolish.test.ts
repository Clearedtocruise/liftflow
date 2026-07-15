import assert from 'node:assert/strict';

import type { WorkoutExercise } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import {
    enrichWithSupersetGroups,
    formatSupersetNavChrome,
    isSupersetMidRound,
    resolvePostSetSupersetAction,
    resolveSupersetGroupNavIndex,
} from './supersetFlow';
import { resolveTraditionalRestSeconds } from './timerEngine';
import {
    applyChallengeDraftBump,
    canOfferMoreChallenges,
    pickWorkoutChallenge,
} from './workoutChallengeFlow';

function planPair(): EditableWorkoutExercise[] {
  return [
    { id: 'a', name: 'Bench', sets: 3, repRange: '8', restSeconds: 90, supersetGroupId: 'ss-1' },
    { id: 'b', name: 'Row', sets: 3, repRange: '8', restSeconds: 90, supersetGroupId: 'ss-1' },
    { id: 'c', name: 'Curl', sets: 3, repRange: '10', restSeconds: 90 },
  ];
}

function sessionWithCounts(counts: number[]): WorkoutExercise[] {
  return counts.map((count, index) => ({
    id: `ex-${index}`,
    workoutSessionId: 's',
    exerciseId: `e-${index}`,
    sortOrder: index,
    sets: Array.from({ length: count }, (_, setIndex) => ({
      id: `set-${index}-${setIndex}`,
      workoutExerciseId: `ex-${index}`,
      reps: 8,
      weight: 100,
      setNumber: setIndex + 1,
      createdAt: '2026-01-01T00:00:00Z',
    })),
    createdAt: '2026-01-01T00:00:00Z',
  })) as unknown as WorkoutExercise[];
}

function run() {
  const plan = planPair();

  assert.equal(resolveSupersetGroupNavIndex(0, plan, 1), 1);
  assert.equal(resolveSupersetGroupNavIndex(1, plan, -1), 0);
  assert.equal(resolveSupersetGroupNavIndex(0, plan, -1), null);
  assert.equal(resolveSupersetGroupNavIndex(1, plan, 1), null);

  const afterA = resolvePostSetSupersetAction(0, plan, sessionWithCounts([1, 0]), 1);
  assert.equal(afterA.skipRest, true);
  assert.equal(afterA.immediateAdvanceIndex, 1);

  const afterRound = resolvePostSetSupersetAction(1, plan, sessionWithCounts([1, 1]), 1);
  assert.equal(afterRound.skipRest, false);
  assert.equal(afterRound.afterRestAdvanceIndex, 0);

  assert.equal(isSupersetMidRound(1, plan, sessionWithCounts([1, 0])), true);
  assert.equal(isSupersetMidRound(0, plan, sessionWithCounts([1, 1])), false);

  const chrome = formatSupersetNavChrome(0, plan, sessionWithCounts([0, 0]));
  assert.ok(chrome?.includes('A'));
  assert.ok(chrome?.includes('Round'));

  assert.equal(resolveTraditionalRestSeconds('superset'), 90);

  const noGroups = [
    { id: '1', name: 'Squat', sets: 3, repRange: '5' },
    { id: '2', name: 'Bench', sets: 3, repRange: '5' },
  ] as EditableWorkoutExercise[];
  assert.equal(enrichWithSupersetGroups(noGroups, 'traditional')[0]?.supersetGroupId, undefined);
  assert.ok(enrichWithSupersetGroups(noGroups, 'superset')[0]?.supersetGroupId);

  const bump = applyChallengeDraftBump(
    { id: 'plus-two-reps', kind: 'reps', title: 'Bonus', prompt: 'x' },
    { reps: 8, weightKg: 100 },
  );
  assert.equal(bump.reps, 10);

  assert.equal(canOfferMoreChallenges([]), true);
  assert.equal(
    canOfferMoreChallenges([
      {
        challengeId: 'plus-two-reps',
        kind: 'reps',
        title: 'Bonus',
        prompt: 'x',
        status: 'skipped',
        trigger: 'between_sets',
      },
    ]),
    true,
  );
  assert.equal(
    canOfferMoreChallenges([
      {
        challengeId: 'plus-two-reps',
        kind: 'reps',
        title: 'Bonus',
        prompt: 'x',
        status: 'completed',
        trigger: 'between_sets',
      },
    ]),
    false,
  );
  assert.equal(pickWorkoutChallenge([], 'between_exercises'), null);

  console.log('supersetChallengePolish.test.ts — PASS');
}

run();

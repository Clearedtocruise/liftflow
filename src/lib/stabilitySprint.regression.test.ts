import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dedupeOverlappingCardio } from '@/lib/cardioHistoryDedupe';
import { classifyExercise } from '@/lib/exerciseClassification';
import { defaultLoadingMethodForExercise, loadingMethodToLoggingMode } from '@/lib/exerciseLoadingMethod';
import { getExerciseLoggingMode } from '@/lib/exerciseModality';
import { resolveMealMacros } from '@/lib/mealIngredients';
import { buildSmartMealReplacementUpdate } from '@/lib/mealReplacement';
import { enrichWithSupersetGroups, inferExecutionModeFromPlan } from '@/lib/supersetFlow';
import { computeWorkoutElapsedSeconds } from '@/lib/workoutElapsed';
import type { Exercise, Meal } from '@/types';
import type { WorkoutHistoryItem } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

function strengthExercise(name: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    category: 'pull',
    exerciseType: 'strength',
    equipment: 'cable',
    muscleGroups: ['lats'],
    isSystem: true,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function planEx(name: string, groupId?: string): EditableWorkoutExercise {
  return {
    id: name,
    name,
    sets: 3,
    repRange: '8-12',
    restSeconds: 90,
    exerciseId: name,
    supersetGroupId: groupId,
  };
}

describe('stability sprint regressions', () => {
  it('does not upgrade traditional mode when stale superset groups exist', () => {
    const plan = [planEx('A', 'ss-1'), planEx('B', 'ss-1'), planEx('C')];
    assert.equal(inferExecutionModeFromPlan(plan, 'traditional'), 'traditional');
  });

  it('strips invented/stale groups for traditional enrich', () => {
    const plan = [planEx('A', 'ss-1'), planEx('B', 'ss-1')];
    const enriched = enrichWithSupersetGroups(plan, 'traditional');
    assert.equal(enriched.every((item) => item.supersetGroupId == null), true);
  });

  it('keeps explicit pairs only for superset mode', () => {
    const plan = [planEx('A'), planEx('B'), planEx('C'), planEx('D')];
    const enriched = enrichWithSupersetGroups(plan, 'superset');
    assert.equal(enriched[0]?.supersetGroupId, 'ss-1');
    assert.equal(enriched[1]?.supersetGroupId, 'ss-1');
  });

  it('logs Commando Pull-Up as bodyweight (not cardio/timed)', () => {
    const type = classifyExercise({
      name: 'Commando Pull-Up',
      slug: 'commando-pull-up',
      equipment: 'bodyweight',
      movementCategory: 'pull',
      exerciseType: 'strength',
    });
    assert.equal(type, 'bodyweight');
    const commando = strengthExercise('Commando Pull-Up', {
      slug: 'commando-pull-up',
      equipment: 'bodyweight',
    });
    assert.equal(getExerciseLoggingMode(commando), 'bodyweight');
    assert.equal(
      loadingMethodToLoggingMode(defaultLoadingMethodForExercise(commando, commando.slug)),
      'bodyweight',
    );
  });

  it('does not treat strength row variations as cardio logging', () => {
    for (const name of ['Hammer Low Row', 'Seated Cable Row', 'Bent Over Row', 'Inverted Row']) {
      assert.notEqual(
        classifyExercise({ name, equipment: 'cable', movementCategory: 'pull', exerciseType: 'strength' }),
        'cardio',
        name,
      );
      assert.notEqual(getExerciseLoggingMode(strengthExercise(name)), 'cardio', name);
    }
  });

  it('still classifies true rowing/cardio machines as cardio', () => {
    assert.equal(classifyExercise({ name: 'Rowing', movementCategory: 'cardio' }), 'cardio');
    assert.equal(classifyExercise({ name: 'Concept 2 Rower', equipment: 'machine' }), 'cardio');
    assert.equal(getExerciseLoggingMode(strengthExercise('Row Erg', { exerciseType: 'cardio', category: 'cardio' })), 'cardio');
  });

  it('rebuilds logging schema when catalog exerciseId changes on same row', () => {
    // Mirrors ActiveWorkoutScreen switch key: workout_exercise id stays stable on replace.
    const rowId = 'we-1';
    const before = `${rowId}:hammer-curl-id`;
    const after = `${rowId}:commando-pull-up-id`;
    assert.notEqual(before, after);
    const next = strengthExercise('Commando Pull-Up', {
      id: 'commando-pull-up-id',
      slug: 'commando-pull-up',
      equipment: 'bodyweight',
    });
    assert.equal(
      loadingMethodToLoggingMode(defaultLoadingMethodForExercise(next, next.slug)),
      'bodyweight',
    );
  });

  it('persists multi-item meal replace macros as the summed total', () => {
    const meal: Meal = {
      id: 'm1',
      userId: 'u1',
      mealType: 'lunch',
      name: 'Chicken bowl',
      scheduledDate: '2026-07-17',
      calories: 500,
      proteinG: 40,
      carbsG: 50,
      fatG: 15,
      instructions: '{}',
      createdAt: '2026-07-01T00:00:00Z',
    };
    const update = buildSmartMealReplacementUpdate(meal, {
      foodName: 'Salmon, rice, broccoli',
      servingSize: '3 items',
      macros: { calories: 620, proteinG: 48, carbsG: 55, fatG: 18 },
      items: [
        { foodName: 'Salmon', servingSize: '6 oz', macros: { calories: 350, proteinG: 40, carbsG: 0, fatG: 14 } },
        { foodName: 'Rice', servingSize: '1 cup', macros: { calories: 200, proteinG: 4, carbsG: 45, fatG: 1 } },
        { foodName: 'Broccoli', servingSize: '1 cup', macros: { calories: 70, proteinG: 4, carbsG: 10, fatG: 3 } },
      ],
    });
    assert.equal(update.calories, 620);
    assert.equal(update.name, 'Salmon, rice, broccoli');
    assert.equal(resolveMealMacros({ ...meal, ...update }).calories, 620);
  });

  it('prefers stored meal macros over re-estimating ingredients', () => {
    const macros = resolveMealMacros({
      name: 'Custom bowl',
      calories: 710,
      proteinG: 55,
      carbsG: 60,
      fatG: 22,
      instructions: JSON.stringify({
        ingredients: [{ name: 'Mystery food', serving: '1 serving' }],
      }),
    });
    assert.equal(macros.calories, 710);
    assert.equal(macros.proteinG, 55);
  });

  it('excludes paused time from workout elapsed seconds', () => {
    const startedAtMs = Date.parse('2026-07-17T10:00:00.000Z');
    const afterTenMinutes = startedAtMs + 10 * 60_000;
    assert.equal(
      computeWorkoutElapsedSeconds({
        startedAtMs,
        nowMs: afterTenMinutes,
        pausedAccumulatedMs: 0,
      }),
      600,
    );
    assert.equal(
      computeWorkoutElapsedSeconds({
        startedAtMs,
        nowMs: afterTenMinutes,
        status: 'paused',
        pausedAtMs: startedAtMs + 8 * 60_000,
        pausedAccumulatedMs: 0,
      }),
      480,
    );
    assert.equal(
      computeWorkoutElapsedSeconds({
        startedAtMs,
        nowMs: afterTenMinutes + 5 * 60_000,
        pausedAccumulatedMs: 2 * 60_000,
      }),
      780,
    );
  });

  it('dedupes overlapping morning cardio chalks keeping the richer sample', () => {
    const weak: WorkoutHistoryItem = {
      id: 'weak',
      name: 'Steady Run',
      date: '2026-07-17T14:22:00.000Z',
      durationMinutes: 26,
      exerciseCount: 0,
      totalSets: 0,
      totalVolume: 0,
      status: 'completed',
      sessionKind: 'cardio',
      distanceMeters: 1223,
      caloriesBurned: 255,
    };
    const rich: WorkoutHistoryItem = {
      id: 'rich',
      name: 'Outdoor Run',
      date: '2026-07-17T14:22:00.000Z',
      durationMinutes: 29,
      exerciseCount: 0,
      totalSets: 0,
      totalVolume: 0,
      status: 'completed',
      sessionKind: 'cardio',
      distanceMeters: 5327,
      caloriesBurned: 900,
    };
    const deduped = dedupeOverlappingCardio([weak, rich]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.id, 'rich');
    assert.equal(deduped[0]?.caloriesBurned, 900);
  });
});

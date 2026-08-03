import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBlockSupersets, enrichWithSmartSupersetGroups } from './applyReferenceSupersets.js';
import { SPLIT_VOLUME_TARGETS } from './liftingProgrammingRules.js';
import { MONTH1_WORKOUTS, MONTH1_WORKOUT_COUNT } from './month1Workouts.js';
import {
  dedupeReferenceDraftExercises,
  getMonth1Workout,
  resolveMonth1Workout,
  shouldUseReferenceLiftingProgram,
  slotLabelKey,
} from './referenceProgramLoader.js';

test('Month 1 contains exactly 24 unique workouts', () => {
  assert.equal(MONTH1_WORKOUTS.length, MONTH1_WORKOUT_COUNT);
  assert.equal(MONTH1_WORKOUT_COUNT, 24);

  const keys = new Set(MONTH1_WORKOUTS.map((w) => `${w.week}-${w.dayIndex}`));
  assert.equal(keys.size, 24);
});

test('Week 1 Monday is chest day with compound first', () => {
  const workout = getMonth1Workout(1, 0);
  assert.ok(workout);
  assert.match(workout!.slotLabel, /Chest/i);
  assert.equal(workout!.exercises[0]?.block, 'A');
  assert.match(workout!.exercises[0]?.name, /Bench Press/i);
});

test('Month 1 push day volume targets ~12 sets per muscle group', () => {
  const pushDays = MONTH1_WORKOUTS.filter((w) => w.slotLabel.includes('Chest'));
  assert.ok(pushDays.length >= 4);

  for (const workout of pushDays) {
    let chestSets = 0;
    let shoulderSets = 0;
    let tricepSets = 0;

    for (const exercise of workout.exercises) {
      const focus = exercise.primaryFocus.toLowerCase();
      if (focus.includes('chest')) chestSets += exercise.sets;
      if (focus.includes('shoulder') || focus.includes('delt')) shoulderSets += exercise.sets;
      if (focus.includes('triceps') || focus.includes('tricep')) tricepSets += exercise.sets;
    }

    assert.ok(chestSets >= 10, `Week ${workout.week} chest sets: ${chestSets}`);
    assert.ok(shoulderSets >= 10, `Week ${workout.week} shoulder sets: ${shoulderSets}`);
    assert.ok(tricepSets >= 8, `Week ${workout.week} tricep sets: ${tricepSets}`);
  }
});

test('applyBlockSupersets groups B1/B2 blocks', () => {
  const grouped = applyBlockSupersets([
    { block: 'A', name: 'Bench', metadata: { movement_family: 'horizontal_press' } },
    { block: 'B1', name: 'Fly', metadata: { movement_family: 'horizontal_press' } },
    { block: 'B2', name: 'Raise', metadata: { movement_family: 'rear_delt' } },
  ]);

  assert.equal(grouped[0].supersetGroupId, undefined);
  assert.equal(grouped[1].supersetGroupId, 'ss-b');
  assert.equal(grouped[2].supersetGroupId, 'ss-b');
});

test('applyBlockSupersets never pairs bare letter compounds', () => {
  const grouped = applyBlockSupersets([
    { block: 'A', name: 'Bench' },
    { block: 'A', name: 'Also Bench' },
    { block: 'D', name: 'OHP' },
  ]);
  assert.equal(grouped[0].supersetGroupId, undefined);
  assert.equal(grouped[1].supersetGroupId, undefined);
  assert.equal(grouped[2].supersetGroupId, undefined);
});

test('smart supersets skip heavy compound pairs', () => {
  const grouped = enrichWithSmartSupersetGroups([
    { name: 'Squat', metadata: { movement_family: 'squat_pattern' } },
    { name: 'Deadlift', metadata: { movement_family: 'hinge_pattern' } },
    { name: 'Curl', metadata: { movement_family: 'biceps' } },
    { name: 'Extension', metadata: { movement_family: 'triceps' } },
  ]);

  assert.equal(grouped[0].supersetGroupId, undefined);
  assert.equal(grouped[1].supersetGroupId, undefined);
  assert.equal(grouped[2].supersetGroupId, 'ss-1');
  assert.equal(grouped[3].supersetGroupId, 'ss-1');
});

test('smart supersets do not invent pairs when movement family is missing', () => {
  const grouped = enrichWithSmartSupersetGroups([
    { name: 'Bench' },
    { name: 'Incline DB' },
    { name: 'Lateral Raise' },
    { name: 'Cable Fly' },
    { name: 'Pushdown' },
    { name: 'OHP' },
  ]);
  assert.deepEqual(
    grouped.map((exercise) => exercise.supersetGroupId),
    [undefined, undefined, undefined, undefined, undefined, undefined],
  );
});

test('slotLabelKey matches schedule labels to Month 1 slot labels', () => {
  assert.equal(
    slotLabelKey('Chest, Shoulders & Triceps'),
    slotLabelKey('Chest / Triceps / Shoulders'),
  );
  assert.equal(slotLabelKey('Back, Biceps & Core'), slotLabelKey('Back / Biceps / Core'));
  assert.equal(slotLabelKey('Legs & Core'), slotLabelKey('Legs / Core'));
});

test('resolveMonth1Workout matches by slot label when day order differs', () => {
  const backOnMonday = resolveMonth1Workout(1, 0, 'Back, Biceps & Core');
  assert.ok(backOnMonday);
  assert.match(backOnMonday!.slotLabel, /Back/i);

  const chestOnTuesday = resolveMonth1Workout(1, 1, 'Chest, Shoulders & Triceps');
  assert.ok(chestOnTuesday);
  assert.match(chestOnTuesday!.slotLabel, /Chest/i);
});

test('shouldUseReferenceLiftingProgram for body part split 3–7 days', () => {
  assert.equal(shouldUseReferenceLiftingProgram('body_part_split', 6), true);
  assert.equal(shouldUseReferenceLiftingProgram('body_part_split', 4), true);
  assert.equal(shouldUseReferenceLiftingProgram('body_part_split', 3), true);
  assert.equal(shouldUseReferenceLiftingProgram('body_part_split', 'custom'), false);
  assert.equal(shouldUseReferenceLiftingProgram('push_pull_legs', 6), false);
});

test('split volume targets match Month 1 spec', () => {
  assert.equal(SPLIT_VOLUME_TARGETS.chest_shoulders_triceps.chest, 12);
  assert.equal(SPLIT_VOLUME_TARGETS.back_biceps_core.core, 12);
  assert.equal(SPLIT_VOLUME_TARGETS.legs_core.calves, 8);
});

test('dedupeReferenceDraftExercises removes duplicates by name and slug', () => {
  const deduped = dedupeReferenceDraftExercises([
    { name: 'Bench Press', slug: 'bench-press', block: 'A' },
    { name: 'Bench-Press', slug: 'bench-press-alt', block: 'B1' },
    { name: 'Incline Bench Press', slug: 'incline-bench-press', block: 'B2' },
    { name: 'Cable Row', slug: 'cable-row', block: 'C' },
    { name: 'Cable Row', slug: 'cable-row', block: 'D' },
  ]);

  assert.deepEqual(
    deduped.map((exercise) => exercise.slug),
    ['bench-press', 'incline-bench-press', 'cable-row'],
  );
  assert.equal(deduped[0]?.block, 'A');
  assert.equal(deduped[2]?.block, 'C');
});

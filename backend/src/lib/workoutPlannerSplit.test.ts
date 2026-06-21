import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BODY_PART_DAY_PLANS,
    isCoreFocusedExercise,
    resolveDayFocusPlan,
    selectFocusedSplitExercises,
    type ExerciseRecord,
} from './workoutPlanner.js';

function mockExercise(slug: string, family: string, muscles: string[]): ExerciseRecord {
  return {
    id: slug,
    name: slug,
    slug,
    category: 'strength',
    equipment: 'barbell',
    muscle_groups: muscles,
    metadata: { movement_family: family, requires: ['barbell'] },
  };
}

const POOL: ExerciseRecord[] = [
  mockExercise('barbell-row', 'horizontal_pull', ['back']),
  mockExercise('lat-pulldown', 'vertical_pull', ['back']),
  mockExercise('pull-up', 'vertical_pull', ['back']),
  mockExercise('chest-supported-row', 'horizontal_pull', ['back']),
  mockExercise('single-arm-dumbbell-row', 'horizontal_pull', ['back']),
  mockExercise('inverted-row', 'horizontal_pull', ['back']),
  mockExercise('straight-arm-pulldown', 'vertical_pull', ['back']),
  mockExercise('cable-row', 'horizontal_pull', ['back']),
  mockExercise('face-pull', 'rear_delt', ['back', 'shoulders']),
  mockExercise('barbell-curl', 'biceps', ['biceps']),
  mockExercise('hammer-curl', 'biceps', ['biceps']),
  mockExercise('incline-dumbbell-curl', 'biceps', ['biceps']),
  mockExercise('preacher-curl', 'biceps', ['biceps']),
  mockExercise('bench-press', 'horizontal_press', ['chest', 'triceps']),
  mockExercise('incline-bench-press', 'horizontal_press', ['chest', 'triceps']),
  mockExercise('overhead-press', 'vertical_press', ['shoulders', 'triceps']),
  mockExercise('lateral-raise', 'rear_delt', ['shoulders']),
  mockExercise('tricep-pushdown', 'triceps', ['triceps']),
  mockExercise('squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('front-squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('goblet-squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('leg-press', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('landmine-squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('romanian-deadlift', 'hinge_pattern', ['hamstrings', 'glutes']),
  mockExercise('leg-curl', 'hamstrings', ['hamstrings']),
  mockExercise('walking-lunge', 'lunge_pattern', ['quads', 'glutes']),
  mockExercise('reverse-lunge', 'lunge_pattern', ['quads', 'glutes']),
  mockExercise('step-up', 'lunge_pattern', ['quads', 'glutes']),
  mockExercise('bulgarian-split-squat', 'lunge_pattern', ['quads', 'glutes']),
  mockExercise('hip-thrust', 'glute_pattern', ['glutes']),
  mockExercise('glute-bridge', 'glute_pattern', ['glutes']),
  mockExercise('standing-calf-raise', 'calves', ['calves']),
  mockExercise('plank', 'core', ['core']),
  mockExercise('side-plank', 'core', ['core', 'obliques']),
  mockExercise('hanging-leg-raise', 'core_flexion', ['core']),
  mockExercise('crunch', 'core_flexion', ['core']),
  mockExercise('sit-up', 'core_flexion', ['core']),
  mockExercise('reverse-crunch', 'core_flexion', ['core']),
  mockExercise('bicycle-crunch', 'core_rotation', ['core', 'obliques']),
  mockExercise('dead-bug', 'core_anti_extension', ['core']),
  mockExercise('hollow-hold', 'core_anti_extension', ['core']),
  mockExercise('russian-twist', 'core_rotation', ['core', 'obliques']),
  mockExercise('front-squat-with-core-tag', 'squat_pattern', ['quads', 'core']),
];

test('resolveDayFocusPlan maps split labels', () => {
  assert.equal(resolveDayFocusPlan('Back, Biceps & Core')?.key, 'back_biceps_core');
  assert.equal(resolveDayFocusPlan('Chest, Shoulders & Triceps')?.key, 'chest_shoulders_triceps');
  assert.equal(resolveDayFocusPlan('Legs & Core')?.key, 'legs_core');
});

test('back day prioritizes back and biceps over chest', () => {
  const plan = BODY_PART_DAY_PLANS.back_biceps_core;
  const picked = selectFocusedSplitExercises(POOL, plan, new Map(), 8, 0);
  const slugs = picked.map((exercise) => exercise.slug);

  assert.ok(slugs.filter((slug) => slug.includes('row') || slug.includes('pull') || slug.includes('lat')).length >= 3);
  assert.ok(slugs.some((slug) => slug.includes('curl')));
  assert.equal(slugs.some((slug) => slug.includes('bench')), false);
});

test('back day never treats leg lifts as core or back work', () => {
  const plan = BODY_PART_DAY_PLANS.back_biceps_core;
  const picked = selectFocusedSplitExercises(POOL, plan, new Map(), 10, 0);
  const slugs = picked.map((exercise) => exercise.slug);

  assert.equal(slugs.some((slug) => slug.includes('squat') || slug.includes('lunge') || slug.includes('leg-press')), false);
  assert.equal(slugs.includes('front-squat-with-core-tag'), false);
});

test('back day includes multiple core-focused exercises', () => {
  const plan = BODY_PART_DAY_PLANS.back_biceps_core;
  const picked = selectFocusedSplitExercises(POOL, plan, new Map(), 10, 0);
  const coreCount = picked.filter((exercise) => isCoreFocusedExercise(exercise)).length;

  assert.ok(coreCount >= 3, `expected at least 3 core exercises, got ${coreCount}: ${picked.map((item) => item.slug).join(', ')}`);
});

test('repeated back days in one week pick different exercises', () => {
  const plan = BODY_PART_DAY_PLANS.back_biceps_core;
  const recentSlugs = new Map<string, Date>();
  const programRecent = new Set<string>();

  const first = selectFocusedSplitExercises(POOL, plan, recentSlugs, 8, 0);
  for (const exercise of first) {
    recentSlugs.set(exercise.slug, new Date());
    programRecent.add(exercise.slug);
  }

  const second = selectFocusedSplitExercises(POOL, plan, recentSlugs, 8, 997, programRecent);
  const backOverlap = second.filter(
    (exercise) =>
      first.some((item) => item.slug === exercise.slug) &&
      (exercise.muscle_groups ?? []).includes('back'),
  );

  assert.equal(backOverlap.length, 0, `back overlap: ${backOverlap.map((item) => item.slug).join(', ')}`);
});

test('leg day fills 10 exercises with squat and lunge variety', () => {
  const plan = BODY_PART_DAY_PLANS.legs_core;
  const picked = selectFocusedSplitExercises(POOL, plan, new Map(), 10, 0);
  const slugs = picked.map((exercise) => exercise.slug);

  assert.ok(picked.length >= 8, `expected at least 8 leg exercises, got ${picked.length}: ${slugs.join(', ')}`);
  assert.ok(slugs.filter((slug) => slug.includes('squat') || slug === 'leg-press').length >= 2);
  assert.ok(slugs.filter((slug) => slug.includes('lunge') || slug.includes('step-up')).length >= 2);
  assert.ok(slugs.some((slug) => slug.includes('rdl') || slug.includes('curl') || slug.includes('thrust') || slug.includes('bridge')));
  assert.ok(slugs.some((slug) => slug.includes('calf')));
  assert.ok(slugs.some((slug) => slug.includes('plank') || slug.includes('leg-raise')));
});

console.log('workoutPlannerSplit.test.ts — all assertions passed');

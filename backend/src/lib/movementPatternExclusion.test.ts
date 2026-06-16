import assert from 'node:assert/strict';
import test from 'node:test';

import { patternExclusionGroupId, sharesPatternFamily } from './movementPatternExclusion.js';
import { selectRotatedExercises, type ExerciseRecord } from './workoutPlanner.js';

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

const LOWER_POOL: ExerciseRecord[] = [
  mockExercise('front-squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('goblet-squat', 'squat_pattern', ['quads']),
  mockExercise('bodyweight-squat', 'squat_pattern', ['quads']),
  mockExercise('squat', 'squat_pattern', ['quads', 'glutes']),
  mockExercise('bulgarian-split-squat', 'lunge_pattern', ['quads', 'glutes', 'unilateral']),
  mockExercise('walking-lunge', 'lunge_pattern', ['quads', 'glutes', 'unilateral']),
  mockExercise('step-up', 'lunge_pattern', ['quads', 'glutes']),
  mockExercise('romanian-deadlift', 'hinge_pattern', ['hamstrings', 'glutes']),
  mockExercise('deadlift', 'hinge_pattern', ['hamstrings', 'glutes']),
  mockExercise('single-leg-rdl', 'hinge_pattern', ['hamstrings', 'glutes']),
  mockExercise('hip-thrust', 'hinge_pattern', ['glutes']),
  mockExercise('standing-calf-raise', 'calves', ['calves']),
  mockExercise('single-leg-calf-raise', 'calves', ['calves']),
  mockExercise('plank', 'core', ['core']),
  mockExercise('side-plank', 'core', ['core']),
];

const LOWER_MUSCLES = ['quads', 'hamstrings', 'glutes', 'calves', 'core', 'unilateral'];

test('pattern exclusion groups dedupe squat and deadlift families', () => {
  assert.equal(patternExclusionGroupId('squat'), patternExclusionGroupId('front-squat'));
  assert.equal(patternExclusionGroupId('deadlift'), patternExclusionGroupId('romanian-deadlift'));
  assert.ok(sharesPatternFamily('walking-lunge', 'bulgarian-split-squat'));
});

test('20 generated lower workouts avoid duplicate pattern families', () => {
  const recentSlugs = new Map<string, Date>();
  const violations: string[] = [];

  for (let i = 0; i < 20; i++) {
    const picked = selectRotatedExercises(LOWER_POOL, LOWER_MUSCLES, recentSlugs, 8);
    const groups = picked.map((e) => patternExclusionGroupId(e.slug)).filter(Boolean);
    const uniqueGroups = new Set(groups);
    if (groups.length !== uniqueGroups.size) {
      violations.push(`workout ${i + 1}: ${picked.map((e) => e.slug).join(', ')}`);
    }
    for (const exercise of picked) {
      recentSlugs.set(exercise.slug, new Date());
    }
  }

  assert.equal(violations.length, 0, violations.join('\n'));
});

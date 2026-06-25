import assert from 'node:assert/strict';
import test from 'node:test';

import { findEquipmentSubstitute } from './equipmentSubstitutionEngine.js';
import type { ExerciseRecord } from './workoutPlanner.js';

function mock(name: string, slug: string, equipment: string, requires: string[], family: string, muscles: string[]): ExerciseRecord {
  return {
    id: slug,
    name,
    slug,
    category: 'strength',
    equipment,
    muscle_groups: muscles,
    metadata: { requires, movement_family: family },
  };
}

const BODYWEIGHT_POOL: ExerciseRecord[] = [
  mock('Goblet Squat', 'goblet-squat', 'dumbbell', ['dumbbells'], 'squat_pattern', ['quads']),
  mock('Bodyweight Squat', 'bodyweight-squat', 'bodyweight', ['bodyweight'], 'squat_pattern', ['quads']),
  mock('Walking Lunge', 'walking-lunge', 'bodyweight', ['bodyweight'], 'lunge_pattern', ['quads']),
  mock('Glute Bridge', 'glute-bridge', 'bodyweight', ['bodyweight'], 'glute_pattern', ['glutes']),
  mock('Russian Twist', 'russian-twist', 'bodyweight', ['bodyweight'], 'core_rotation', ['core']),
  mock('Plank', 'plank', 'bodyweight', ['bodyweight'], 'core', ['core']),
  mock('Dead Bug', 'dead-bug', 'bodyweight', ['bodyweight'], 'core_anti_extension', ['core']),
];

test('leg extension swaps to bodyweight-friendly quad movement without machines', () => {
  const swap = findEquipmentSubstitute('Leg Extension', ['bodyweight', 'bands'], BODYWEIGHT_POOL);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 'dumbbell row');
  assert.match(swap!.to.toLowerCase(), /squat|lunge/);
});

test('seated leg curl does not swap to a back/lat row', () => {
  const swap = findEquipmentSubstitute('Seated Leg Curl', ['bodyweight', 'bands'], BODYWEIGHT_POOL);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 'dumbbell row');
});

test('cable wood chop swaps to core movement not dumbbell row', () => {
  const swap = findEquipmentSubstitute('Cable Wood Chop', ['bodyweight', 'bands'], BODYWEIGHT_POOL);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 'dumbbell row');
  assert.match(swap!.to.toLowerCase(), /twist|plank|dead bug/);
});

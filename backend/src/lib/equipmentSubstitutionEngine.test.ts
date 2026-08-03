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

const GYM_NO_CABLE_POOL: ExerciseRecord[] = [
  mock('Dumbbell Fly', 'dumbbell-fly', 'dumbbell', ['dumbbells'], 'horizontal_press', ['chest']),
  mock('Incline Dumbbell Press', 'incline-dumbbell-press', 'dumbbell', ['dumbbells', 'bench'], 'horizontal_press', ['chest']),
  mock('Push-Up', 'push-up', 'bodyweight', ['bodyweight'], 'horizontal_press', ['chest']),
  mock('EZ-Bar Skull Crusher', 'skull-crusher', 'barbell', ['barbell', 'bench'], 'triceps', ['triceps']),
  mock('Dumbbell Overhead Triceps Extension', 'overhead-triceps-extension', 'dumbbell', ['dumbbells'], 'triceps', ['triceps']),
  mock('Dumbbell Row', 'dumbbell-row', 'dumbbell', ['dumbbells'], 'horizontal_pull', ['back']),
  mock('Band Row', 'band-row', 'bands', ['bands'], 'horizontal_pull', ['back']),
];

const GYM_EQUIPMENT = ['barbell', 'dumbbells', 'bench', 'rack', 'bodyweight'];

test('cable fly swaps to chest movement not row without cable', () => {
  const swap = findEquipmentSubstitute('Cable Fly', GYM_EQUIPMENT, GYM_NO_CABLE_POOL);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 'dumbbell row');
  assert.notEqual(swap!.to.toLowerCase(), 'band row');
  assert.match(swap!.to.toLowerCase(), /fly|press|push-up/);
});

test('rope triceps pushdown swaps to dumbbell or EZ bar without cable', () => {
  const swap = findEquipmentSubstitute('Rope Triceps Pushdown', GYM_EQUIPMENT, GYM_NO_CABLE_POOL);
  assert.ok(swap);
  assert.match(swap!.to.toLowerCase(), /skull|triceps|extension/);
});

test('overhead rope triceps extension swaps to dumbbell or EZ bar without cable', () => {
  const swap = findEquipmentSubstitute('Overhead Rope Triceps Extension', GYM_EQUIPMENT, GYM_NO_CABLE_POOL);
  assert.ok(swap);
  assert.match(swap!.to.toLowerCase(), /skull|triceps|extension/);
});

test('band row is not suggested when bands are unavailable', () => {
  const pool: ExerciseRecord[] = [
    mock('Band Row', 'band-row', 'bands', ['bands'], 'horizontal_pull', ['back']),
    mock('Dumbbell Row', 'dumbbell-row', 'dumbbell', ['dumbbells'], 'horizontal_pull', ['back']),
    mock('Pull Up', 'pull-up', 'bodyweight', ['bodyweight'], 'vertical_pull', ['back']),
  ];
  const swap = findEquipmentSubstitute('Lat Pulldown', ['barbell', 'dumbbells', 'bodyweight'], pool);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 'band row');
});

const ROW_POOL: ExerciseRecord[] = [
  mock('T-Bar Row', 't-bar-row', 'barbell', ['landmine'], 'horizontal_pull', ['back']),
  mock('Barbell Row', 'barbell-row', 'barbell', ['barbell'], 'horizontal_pull', ['back']),
  mock('Dumbbell Row', 'dumbbell-row', 'dumbbell', ['dumbbells'], 'horizontal_pull', ['back']),
  mock('Band Row', 'band-row', 'bands', ['bands'], 'horizontal_pull', ['back']),
];

test('t-bar row swaps off when landmine equipment is missing', () => {
  const swap = findEquipmentSubstitute('T-Bar Row', ['barbell', 'rack', 'dumbbells'], ROW_POOL);
  assert.ok(swap);
  assert.notEqual(swap!.to.toLowerCase(), 't-bar row');
  assert.match(swap!.to.toLowerCase(), /barbell row|dumbbell row/);
});

test('t-bar row stays when landmine is available', () => {
  const swap = findEquipmentSubstitute('T-Bar Row', ['barbell', 'rack', 'landmine'], ROW_POOL);
  assert.equal(swap, null);
});

import assert from 'node:assert/strict';

import {
  applyEquipmentSubstitutionsToExercises,
  findEquipmentSubstitute,
  type PlannedExerciseRow,
} from './equipmentSubstitutionEngine.js';
import type { ExerciseRecord } from './workoutPlanner.js';

const POOL: ExerciseRecord[] = [
  {
    id: '1',
    name: 'Cable Fly',
    slug: 'cable-fly',
    category: 'push',
    equipment: 'cable',
    muscle_groups: ['chest'],
    metadata: { requires: ['machines'], movement_family: 'horizontal_press' },
  },
  {
    id: '2',
    name: 'Push-Up',
    slug: 'push-up',
    category: 'push',
    equipment: 'bodyweight',
    muscle_groups: ['chest'],
    metadata: { requires: ['bodyweight'], movement_family: 'horizontal_press' },
  },
  {
    id: '3',
    name: 'Lat Pulldown',
    slug: 'lat-pulldown',
    category: 'pull',
    equipment: 'cable',
    muscle_groups: ['back'],
    metadata: { requires: ['machines'], movement_family: 'vertical_pull' },
  },
  {
    id: '4',
    name: 'Pull Up',
    slug: 'pull-up',
    category: 'pull',
    equipment: 'bodyweight',
    muscle_groups: ['back'],
    metadata: { requires: ['pull_up_bar'], movement_family: 'vertical_pull' },
  },
];

function run() {
  const homeEquipment = ['dumbbells', 'bench', 'pull_up_bar', 'bodyweight'];

  const cableFlySwap = findEquipmentSubstitute('Cable Fly', homeEquipment, POOL);
  assert.ok(cableFlySwap);
  assert.equal(cableFlySwap.to, 'Push-Up');

  const latSwap = findEquipmentSubstitute('Lat Pulldown', homeEquipment, POOL);
  assert.ok(latSwap);
  assert.equal(latSwap.to, 'Pull Up');

  const exercises: PlannedExerciseRow[] = [
    { name: 'Cable Fly', sets: 3, reps: '12', restSeconds: 60 },
    { name: 'Lat Pulldown', sets: 3, reps: '10', restSeconds: 90 },
  ];
  const { exercises: updated, swaps } = applyEquipmentSubstitutionsToExercises(
    exercises,
    homeEquipment,
    POOL,
  );
  assert.equal(swaps.length, 2);
  assert.equal(updated[0].name, 'Push-Up');
  assert.equal(updated[1].name, 'Pull Up');

  const fullGym = ['full_gym', 'machines'];
  const noSwap = findEquipmentSubstitute('Cable Fly', fullGym, POOL);
  assert.equal(noSwap, null);

  console.log('equipmentSubstitutionEngine.test.ts — 4/4 PASS');
}

run();

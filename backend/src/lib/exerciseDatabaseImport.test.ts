import assert from 'node:assert/strict';
import test from 'node:test';

import {
    analyzeOneMoreCatalog,
    isPlaceholderExerciseName,
    mapOneMoreRowToLiftFlow,
} from './exerciseDatabaseImport.js';

test('detects placeholder variation names', () => {
  assert.equal(isPlaceholderExerciseName('Chest Push Variation 1'), true);
  assert.equal(isPlaceholderExerciseName('Barbell Curl'), false);
});

test('maps spreadsheet row to LiftFlow exercise shape', () => {
  const mapped = mapOneMoreRowToLiftFlow({
    exercise_id: 'BI0005',
    exercise_name: 'Hammer Curl',
    primary_muscle: 'BI',
    secondary_muscle: 'FA',
    equipment_code: 'DB1',
    difficulty: 'Intermediate',
    movement_pattern: 'Curl',
    description: 'Curl with neutral grip.',
    home_gym_compatible: 'Yes',
    ai_replacement_category: 'BI',
  });

  assert.equal(mapped.slug, 'hammer-curl');
  assert.equal(mapped.muscleGroups[0], 'biceps');
  assert.equal(mapped.secondaryMuscles[0], 'forearms');
  assert.equal(mapped.equipment, 'dumbbell');
  assert.equal(mapped.isPlaceholder, false);
});

test('analyze flags all-variation catalogs as non-importable', () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({
    exercise_id: `CH000${index + 1}`,
    exercise_name: `Chest Push Variation ${index + 1}`,
    primary_muscle: 'CH',
    secondary_muscle: 'BA',
    equipment_code: 'BW0',
    difficulty: 'Beginner',
    movement_pattern: 'Push',
    description: 'Placeholder',
    home_gym_compatible: 'Yes',
    ai_replacement_category: 'CH',
  }));

  const analysis = analyzeOneMoreCatalog(rows);
  assert.equal(analysis.totalRows, 3);
  assert.equal(analysis.placeholderCount, 3);
  assert.equal(analysis.importableCount, 0);
});

console.log('exerciseDatabaseImport.test.ts — all assertions passed');

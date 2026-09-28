import assert from 'node:assert/strict';
import test from 'node:test';

import { coachReasonForLoggingMode } from './coachAdjustmentLabels';
import { classifyExercise } from './exerciseClassification';
import { inferLoadingMethodFromHistory, loadingMethodToLoggingMode, supportedLoadingMethods } from './exerciseLoadingMethod';
import { getExerciseLoggingMode } from './exerciseModality';

const FLAT_NAMES = ['Flat LWG Pull Down', 'Flat Lying Pulldown', 'flat lying pull-down', 'Flat Lying Pull Downs'];

test('flat lying pulldown logs as bodyweight even when stored like a cable pulldown', () => {
  for (const name of FLAT_NAMES) {
    assert.equal(
      classifyExercise({
        name,
        slug: 'lat-pulldown',
        equipment: 'cable',
        exerciseType: 'strength',
      }),
      'bodyweight',
      name,
    );
    assert.equal(
      getExerciseLoggingMode(
        {
          name,
          slug: 'lat-pulldown',
          equipment: 'cable',
          exerciseType: 'strength',
        } as never,
        '12',
        name,
      ),
      'bodyweight',
      name,
    );
  }
});

test('cable lat pulldowns stay weighted', () => {
  for (const name of ['Lat Pulldown', 'Cable Lat Pulldown', 'Straight-Arm Pulldown', 'Wide-Grip Lat Pulldown']) {
    assert.equal(classifyExercise({ name, slug: 'lat-pulldown', equipment: 'cable', exerciseType: 'strength' }), 'strength', name);
    assert.equal(getExerciseLoggingMode(null, null, name), 'weighted', name);
  }
});

test('a previous 5 lb log does not put a weight stepper on a flat lying pulldown', () => {
  const exercise = { name: 'Flat Lying Pulldown', slug: 'flat-lying-pulldown', exerciseType: 'strength' } as never;
  assert.deepEqual(supportedLoadingMethods(exercise), ['bodyweight']);
  const method = inferLoadingMethodFromHistory(exercise, 'flat-lying-pulldown', 2.27, null);
  assert.equal(method, 'bodyweight');
  assert.equal(loadingMethodToLoggingMode(method), 'bodyweight');
});

test('lat pulldown history still infers an external load', () => {
  const exercise = { name: 'Lat Pulldown', slug: 'lat-pulldown', equipment: 'cable', exerciseType: 'strength' } as never;
  const method = inferLoadingMethodFromHistory(exercise, 'lat-pulldown', 54, null);
  assert.equal(loadingMethodToLoggingMode(method), 'weighted');
});

test('bodyweight coach copy does not ask for a working weight', () => {
  assert.equal(
    coachReasonForLoggingMode('No prior history — pick a manageable working weight.', 'bodyweight'),
    'No prior history — log the reps you can do with good form.',
  );
  assert.equal(
    coachReasonForLoggingMode('No prior history — pick a manageable working weight.', 'weighted'),
    'No prior history — pick a manageable working weight.',
  );
});

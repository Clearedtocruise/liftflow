import assert from 'node:assert/strict';
import test from 'node:test';

import { inferLoadingMethodFromHistory, supportedLoadingMethods } from './exerciseLoadingMethod';

test('hanging leg raise offers bodyweight and added weight', () => {
  assert.deepEqual(supportedLoadingMethods({ name: 'Hanging Leg Raise', slug: 'hanging-leg-raise' } as never), [
    'bodyweight',
    'bodyweight_plus_weight',
  ]);
});

test('a custom hanging-leg-raise row without catalog loadingMethods still offers added weight', () => {
  assert.deepEqual(
    supportedLoadingMethods({ name: 'Hanging Leg Raises', slug: 'hanging-leg-raises-custom' } as never),
    ['bodyweight', 'bodyweight_plus_weight'],
  );
});

const barbellRow = { name: 'Barbell Row', slug: 'barbell-row', equipment: 'barbell', exerciseType: 'strength' } as never;

test('every loaded lift can be switched to bodyweight only', () => {
  assert.deepEqual(supportedLoadingMethods(barbellRow), ['external_load', 'bodyweight']);
  assert.deepEqual(supportedLoadingMethods({ name: 'DB Thrusters', slug: 'db-thrusters' } as never), [
    'external_load',
    'bodyweight',
  ]);
});

test('lifts that are already bodyweight, timed or distance keep their own options', () => {
  assert.deepEqual(supportedLoadingMethods({ name: 'Pull Up', slug: 'pull-up' } as never), [
    'bodyweight',
    'bodyweight_plus_weight',
  ]);
  assert.deepEqual(supportedLoadingMethods({ name: 'Plank', slug: 'plank' } as never), ['timed_hold']);
});

test('a loaded lift opens loaded, and stays bodyweight once it was last logged that way', () => {
  assert.equal(inferLoadingMethodFromHistory(barbellRow, 'barbell-row', null, null, null), 'external_load');
  assert.equal(inferLoadingMethodFromHistory(barbellRow, 'barbell-row', 60, null, 8), 'external_load');
  assert.equal(inferLoadingMethodFromHistory(barbellRow, 'barbell-row', null, null, 12), 'bodyweight');
});

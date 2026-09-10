import assert from 'node:assert/strict';
import test from 'node:test';

import { supportedLoadingMethods } from './exerciseLoadingMethod';

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

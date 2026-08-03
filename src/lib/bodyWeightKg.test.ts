import assert from 'node:assert/strict';
import test from 'node:test';

import { isInvertedBodyWeightKg, normalizeBodyWeightKg } from './bodyWeightKg';

test('normalizeBodyWeightKg undoes lbs×2.2 storage', () => {
  assert.ok(Math.abs(normalizeBodyWeightKg(402.2) - 82.8) < 0.5);
  assert.equal(normalizeBodyWeightKg(85), 85);
  assert.equal(isInvertedBodyWeightKg(402.2), true);
  assert.equal(isInvertedBodyWeightKg(85), false);
});

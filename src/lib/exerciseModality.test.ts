import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSetLoggedLabel } from './exerciseModality';

test('weighted sets with a load show weight × reps', () => {
  assert.equal(
    formatSetLoggedLabel('weighted', { weight: 22.7, reps: 8 }, (kg) => String(Math.round(kg * 2.20462)), 'lb'),
    '50 lb × 8',
  );
});

test('weighted sets without a load do not look like bodyweight', () => {
  assert.equal(
    formatSetLoggedLabel('weighted', { weight: 0, reps: 8 }, () => '0', 'lb'),
    '— lb × 8',
  );
  assert.equal(
    formatSetLoggedLabel('weighted', { weight: null, reps: 8 }, () => '0', 'lb'),
    '— lb × 8',
  );
});

test('bodyweight sets stay reps-only', () => {
  assert.equal(
    formatSetLoggedLabel('bodyweight', { weight: 0, reps: 12 }, () => '0', 'lb'),
    '12 reps',
  );
});

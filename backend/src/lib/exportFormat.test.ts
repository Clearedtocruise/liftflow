import assert from 'node:assert/strict';
import test from 'node:test';

import { formatExportDateTime, formatExportWeight, resolveExportWeightUnit } from './exportFormat.js';

test('kilograms are converted to pounds instead of being labelled as pounds', () => {
  assert.equal(formatExportWeight(92.99, 'lb'), '205 lb');
  assert.equal(formatExportWeight(36.29, 'lb'), '80 lb');
});

test('kilogram lifters keep their stored value', () => {
  assert.equal(formatExportWeight(92.99, 'kg'), '93 kg');
  assert.equal(formatExportWeight(36.29, 'kg'), '36.3 kg');
});

test('missing weights print a dash', () => {
  assert.equal(formatExportWeight(null, 'lb'), '-');
  assert.equal(formatExportWeight(undefined, 'kg'), '-');
});

test('only an explicit kg preference switches the unit', () => {
  assert.equal(resolveExportWeightUnit('kg'), 'kg');
  assert.equal(resolveExportWeightUnit('lb'), 'lb');
  assert.equal(resolveExportWeightUnit(null), 'lb');
});

test('a late-evening session lands on the lifter\'s own day', () => {
  assert.match(formatExportDateTime('2026-10-14T02:30:00Z', 'America/Los_Angeles'), /^10\/13\/2026/);
  assert.match(formatExportDateTime('2026-10-14T02:30:00Z', 'not/a-zone'), /2026/);
});

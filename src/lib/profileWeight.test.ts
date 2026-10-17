import assert from 'node:assert/strict';
import test from 'node:test';

import { parseProfileWeightInput, shouldApplyHealthWeight } from './profileWeight';

test('pounds typed in Settings are saved as kilograms', () => {
  const parsed = parseProfileWeightInput('182.5', 'lb');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.ok(Math.abs(parsed.kg - 82.78) < 0.01);
});

test('kilograms typed in Settings are saved as typed', () => {
  assert.deepEqual(parseProfileWeightInput('82.8', 'kg'), { ok: true, kg: 82.8 });
});

test('empty or impossible weights are rejected', () => {
  assert.equal(parseProfileWeightInput('', 'lb').ok, false);
  assert.equal(parseProfileWeightInput('abc', 'lb').ok, false);
  assert.equal(parseProfileWeightInput('600', 'lb').ok, false);
  assert.equal(parseProfileWeightInput('20', 'kg').ok, false);
});

const logged = { kg: 82.78, recordedAt: '2026-07-31T12:46:44Z' };

test('a Health sample that is pounds read as kilograms never replaces the logged weight', () => {
  assert.equal(shouldApplyHealthWeight({ kg: 182.48, recordedAt: '2026-10-17T13:29:00Z' }, logged), false);
});

test('a Health sample older than the logged weight does not replace it', () => {
  assert.equal(shouldApplyHealthWeight({ kg: 83.5, recordedAt: '2026-06-10T06:59:59Z' }, logged), false);
});

test('a newer plausible Health sample replaces the logged weight', () => {
  assert.equal(shouldApplyHealthWeight({ kg: 82.1, recordedAt: '2026-10-10T06:00:00Z' }, logged), true);
});

test('with no logged weight, any in-range Health sample applies', () => {
  assert.equal(shouldApplyHealthWeight({ kg: 82.1, recordedAt: '2026-10-10T06:00:00Z' }, null), true);
  assert.equal(shouldApplyHealthWeight({ kg: 402.3, recordedAt: '2026-10-10T06:00:00Z' }, null), false);
});

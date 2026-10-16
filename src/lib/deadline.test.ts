import assert from 'node:assert/strict';
import test from 'node:test';

import { formatElapsed, settleWithin } from './deadline';

test('work that finishes in time is reported as settled', async () => {
  assert.equal(await settleWithin(Promise.resolve(1), 200), 'settled');
});

test('work that fails still counts as settled, and never throws', async () => {
  assert.equal(await settleWithin(Promise.reject(new Error('boom')), 200), 'settled');
});

test('work that never finishes does not hold the caller past the deadline', async () => {
  const started = Date.now();
  assert.equal(await settleWithin(new Promise(() => undefined), 50), 'timed_out');
  assert.ok(Date.now() - started < 1000);
});

test('elapsed time reads as seconds, then minutes', () => {
  assert.equal(formatElapsed(0), '0s');
  assert.equal(formatElapsed(42.9), '42s');
  assert.equal(formatElapsed(65), '1m 05s');
  assert.equal(formatElapsed(-3), '0s');
});

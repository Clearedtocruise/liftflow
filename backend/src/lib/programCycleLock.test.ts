import assert from 'node:assert/strict';
import test from 'node:test';

import { withCycleLock } from './programCycleService.js';

test('cycle writes for one lifter run one after another, never side by side', async () => {
  const events: string[] = [];
  const job = (name: string, ms: number) => async () => {
    events.push(`${name} start`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    events.push(`${name} end`);
  };
  await Promise.all([withCycleLock('u1', job('a', 20)), withCycleLock('u1', job('b', 1)), withCycleLock('u1', job('c', 1))]);
  assert.deepEqual(events, ['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
});

test('a failed write does not block the next one', async () => {
  await assert.rejects(withCycleLock('u2', async () => { throw new Error('boom'); }));
  assert.equal(await withCycleLock('u2', async () => 'ran'), 'ran');
});

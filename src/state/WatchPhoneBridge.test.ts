import assert from 'node:assert/strict';
import test from 'node:test';

import { watchPhoneBridge } from './WatchPhoneBridge';

function reset() {
  watchPhoneBridge.setLogSetHandler(null);
  watchPhoneBridge.setFallbackLogSetHandler(null);
}

test('a wrist tap with no workout anywhere explains what to do', async () => {
  reset();
  const result = await watchPhoneBridge.logCurrentSet();
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /Start a workout/);
  assert.equal(watchPhoneBridge.canLogSet(), false);
});

test('the session fallback logs when the workout screen is closed', async () => {
  reset();
  let calls = 0;
  watchPhoneBridge.setFallbackLogSetHandler(async () => {
    calls += 1;
    return { ok: true };
  });

  assert.equal(watchPhoneBridge.canLogSet(), true);
  const result = await watchPhoneBridge.logCurrentSet();
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  reset();
});

test('the workout screen handler wins while it is mounted', async () => {
  reset();
  let screenCalls = 0;
  let fallbackCalls = 0;
  watchPhoneBridge.setFallbackLogSetHandler(async () => {
    fallbackCalls += 1;
    return { ok: true };
  });
  watchPhoneBridge.setLogSetHandler(async () => {
    screenCalls += 1;
    return { ok: true };
  });

  await watchPhoneBridge.logCurrentSet();
  assert.equal(screenCalls, 1);
  assert.equal(fallbackCalls, 0);

  // Leaving the workout screen must hand back to the fallback, not break logging.
  watchPhoneBridge.setLogSetHandler(null);
  await watchPhoneBridge.logCurrentSet();
  assert.equal(screenCalls, 1);
  assert.equal(fallbackCalls, 1);
  reset();
});

test('a throwing handler surfaces its message instead of crashing', async () => {
  reset();
  watchPhoneBridge.setFallbackLogSetHandler(async () => {
    throw new Error('Network unavailable');
  });

  const result = await watchPhoneBridge.logCurrentSet();
  assert.equal(result.ok, false);
  assert.equal((result as { error: string }).error, 'Network unavailable');
  reset();
});

test('dictated reps and weight survive until they are cleared', () => {
  reset();
  watchPhoneBridge.applyReps(12);
  watchPhoneBridge.applyWeightLbs(225);

  assert.equal(watchPhoneBridge.getPendingWatchReps(), 12);
  const kg = watchPhoneBridge.getPendingWatchWeightKg();
  assert.ok(kg != null && Math.abs(kg - 102.06) < 0.1, `expected ~102 kg, got ${kg}`);

  watchPhoneBridge.clearPendingWatchReps();
  watchPhoneBridge.clearPendingWatchWeightKg();
  assert.equal(watchPhoneBridge.getPendingWatchReps(), null);
  assert.equal(watchPhoneBridge.getPendingWatchWeightKg(), null);
});

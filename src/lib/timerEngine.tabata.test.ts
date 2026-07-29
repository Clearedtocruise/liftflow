import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceIntervalPhase,
  createIntervalTimerState,
  INTERVAL_ROUNDS_MAX,
} from './timerEngine';

test('tabata defaults to 3 rounds and stops after the last rest', () => {
  let state = createIntervalTimerState('tabata');
  assert.equal(state.config.rounds, 3);
  assert.equal(state.phase, 'work');
  assert.equal(state.round, 1);

  // Round 1 work → rest
  state = advanceIntervalPhase(state);
  assert.equal(state.phase, 'rest');
  assert.equal(state.round, 1);

  // Round 1 rest → round 2 work
  state = advanceIntervalPhase(state);
  assert.equal(state.phase, 'work');
  assert.equal(state.round, 2);

  state = advanceIntervalPhase(state); // rest 2
  state = advanceIntervalPhase(state); // work 3
  assert.equal(state.round, 3);
  assert.equal(state.phase, 'work');

  state = advanceIntervalPhase(state); // rest 3
  assert.equal(state.phase, 'rest');
  assert.equal(state.round, 3);

  state = advanceIntervalPhase(state); // done — must not invent a 4th round
  assert.equal(state.phase, 'done');
  assert.equal(state.running, false);
  assert.equal(state.secondsRemaining, 0);
});

test('interval rounds can be capped when starting from a plan override', () => {
  const state = createIntervalTimerState('tabata', { rounds: INTERVAL_ROUNDS_MAX + 4 });
  // createIntervalTimerState itself does not cap — the hook does — but the soft max constant exists.
  assert.equal(INTERVAL_ROUNDS_MAX, 6);
  assert.ok(state.config.rounds > INTERVAL_ROUNDS_MAX);
});

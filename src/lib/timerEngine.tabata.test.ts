import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceIntervalPhase,
  clampIntervalRounds,
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

test('tabata supports 10 rounds of 20s work / 20s rest', () => {
  let state = createIntervalTimerState('tabata', {
    workSeconds: 20,
    restSeconds: 20,
    rounds: 10,
  });
  assert.equal(state.config.workSeconds, 20);
  assert.equal(state.config.restSeconds, 20);
  assert.equal(state.config.rounds, 10);
  assert.equal(clampIntervalRounds(10), 10);
  assert.ok(10 <= INTERVAL_ROUNDS_MAX);

  for (let round = 1; round <= 10; round += 1) {
    assert.equal(state.phase, 'work');
    assert.equal(state.round, round);
    state = advanceIntervalPhase(state);
    assert.equal(state.phase, 'rest');
    assert.equal(state.round, round);
    state = advanceIntervalPhase(state);
  }
  assert.equal(state.phase, 'done');
});

test('interval rounds soft max is 12', () => {
  assert.equal(INTERVAL_ROUNDS_MAX, 12);
  assert.equal(clampIntervalRounds(INTERVAL_ROUNDS_MAX + 4), INTERVAL_ROUNDS_MAX);
  assert.equal(clampIntervalRounds(0), 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEndOfSpeechState,
  DEFAULT_END_OF_SPEECH,
  reduceEndOfSpeech,
} from './endOfSpeech';

const cfg = DEFAULT_END_OF_SPEECH;

test('does not stop during early silence before the user speaks', () => {
  let state = createEndOfSpeechState(0);
  const tick = reduceEndOfSpeech(state, -60, 500, cfg);
  assert.equal(tick.shouldStop, false);
  state = tick.state;
  const later = reduceEndOfSpeech(state, -60, 2000, cfg);
  assert.equal(later.shouldStop, false);
});

test('stops after sustained silence once speech was heard', () => {
  let state = createEndOfSpeechState(0);
  state = reduceEndOfSpeech(state, -20, 300, cfg).state;
  assert.equal(state.speechHeard, true);

  const mid = reduceEndOfSpeech(state, -55, 800, cfg);
  assert.equal(mid.shouldStop, false);

  const done = reduceEndOfSpeech(mid.state, -55, 300 + cfg.endSilenceMs + 50, cfg);
  assert.equal(done.shouldStop, true);
  assert.equal(done.reason, 'end_silence');
});

test('stops if nobody speaks before no-speech timeout', () => {
  const state = createEndOfSpeechState(0);
  const done = reduceEndOfSpeech(state, -70, cfg.noSpeechTimeoutMs + 1, cfg);
  assert.equal(done.shouldStop, true);
  assert.equal(done.reason, 'no_speech');
});

test('loud frames reset the silence clock', () => {
  let state = createEndOfSpeechState(0);
  state = reduceEndOfSpeech(state, -20, 200, cfg).state;
  state = reduceEndOfSpeech(state, -55, 900, cfg).state;
  state = reduceEndOfSpeech(state, -18, 1000, cfg).state;
  const notYet = reduceEndOfSpeech(state, -55, 1500, cfg);
  assert.equal(notYet.shouldStop, false);
  const done = reduceEndOfSpeech(notYet.state, -55, 1000 + cfg.endSilenceMs + 20, cfg);
  assert.equal(done.shouldStop, true);
});

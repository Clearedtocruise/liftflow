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

test('does not auto-stop on silence before speech (avoids duck-then-nothing)', () => {
  const state = createEndOfSpeechState(0);
  const done = reduceEndOfSpeech(state, -70, 20_000, cfg);
  assert.equal(done.shouldStop, false);
});

test('optional no-speech timeout still works when explicitly configured', () => {
  const short = { ...cfg, noSpeechTimeoutMs: 5000 };
  const state = createEndOfSpeechState(0);
  const done = reduceEndOfSpeech(state, -70, 5001, short);
  assert.equal(done.shouldStop, true);
  assert.equal(done.reason, 'no_speech');
});

test('a recorder that never reports metering keeps recording (hard cap / tap stop)', () => {
  let state = createEndOfSpeechState(0);
  const early = reduceEndOfSpeech(state, undefined, 1000, cfg);
  assert.equal(early.shouldStop, false);

  const later = reduceEndOfSpeech(early.state, undefined, 20_000, cfg);
  assert.equal(later.shouldStop, false);
  assert.equal(later.reason, undefined);
});

test('non-finite metering is treated as no reading rather than as speech or no-speech', () => {
  const state = createEndOfSpeechState(0);
  const nan = reduceEndOfSpeech(state, Number.NaN, 1000, cfg);
  assert.equal(nan.state.speechHeard, false);
  assert.equal(nan.shouldStop, false);

  const later = reduceEndOfSpeech(nan.state, Number.NaN, 20_000, cfg);
  assert.equal(later.shouldStop, false);
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

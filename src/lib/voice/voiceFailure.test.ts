import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isThrottled,
  toVoiceFailure,
  voiceCooldownMs,
  voiceFailureMessage,
  VOICE_BUSY_MESSAGE,
  VOICE_GENERIC_MESSAGE,
  VOICE_OFFLINE_MESSAGE,
  VOICE_SIGNED_OUT_MESSAGE,
} from './voiceFailure';

class FakeApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

test('a throttled transcribe says how long the wall lasts', () => {
  const failure = toVoiceFailure(
    new FakeApiError('Voice is busy — wait a few seconds and try that set again.', 429, 'VOICE_RATE_LIMITED', 12),
  );

  assert.equal(isThrottled(failure), true);
  assert.equal(voiceFailureMessage(failure), 'Voice is busy — try again in 12s.');
  assert.equal(voiceCooldownMs(failure), 12_000);
});

test('a throttle without a Retry-After still reads as busy', () => {
  const failure = toVoiceFailure(new FakeApiError('Too many requests — slow down', 429, 'RATE_LIMITED'));

  assert.equal(voiceFailureMessage(failure), VOICE_BUSY_MESSAGE);
  assert.equal(voiceCooldownMs(failure), 0);
});

test('an expired session is never reported as a busy server', () => {
  // The old substring match sent every lifter to "wait a few seconds" for a failure that
  // waiting cannot fix.
  const failure = toVoiceFailure(new FakeApiError('Invalid or expired token', 401));

  assert.equal(isThrottled(failure), false);
  assert.equal(voiceFailureMessage(failure), VOICE_SIGNED_OUT_MESSAGE);
});

test('a backend message that happens to mention rate limits keeps its own copy', () => {
  const failure = toVoiceFailure(
    new FakeApiError('Could not reach the transcription service. Try again.', 502),
  );

  assert.equal(isThrottled(failure), false);
  assert.equal(voiceFailureMessage(failure), 'Could not reach the transcription service. Try again.');
});

test('a dropped connection reads as offline, not as a broken mic', () => {
  const failure = toVoiceFailure(new TypeError('Network request failed'));

  assert.equal(voiceFailureMessage(failure), VOICE_OFFLINE_MESSAGE);
  assert.equal(voiceCooldownMs(failure), 0);
});

test('an error with no status or message falls back to the generic retry', () => {
  assert.equal(voiceFailureMessage(toVoiceFailure(new Error(''))), VOICE_GENERIC_MESSAGE);
  assert.equal(voiceFailureMessage(toVoiceFailure(undefined)), VOICE_GENERIC_MESSAGE);
});

test('a statusless rate-limit string is still treated as a throttle', () => {
  // Older callers wrap the backend copy in a plain Error before it reaches here.
  assert.equal(isThrottled(toVoiceFailure(new Error('Voice is busy — wait a few seconds'))), true);
});

test('the cooldown is capped at the width of the server window', () => {
  const failure = toVoiceFailure(new FakeApiError('slow down', 429, 'RATE_LIMITED', 3_600));

  assert.equal(voiceCooldownMs(failure), 60_000);
});

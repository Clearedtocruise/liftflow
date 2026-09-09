import assert from 'node:assert/strict';
import test from 'node:test';

import { isRecorderSessionBusyError } from './recorderSessionError';

test('recognizes leftover-recorder errors as a session that can be retried', () => {
  assert.equal(
    isRecorderSessionBusyError(new Error('Only one Recording object can be prepared at a given time')),
    true,
  );
  assert.equal(
    isRecorderSessionBusyError(new Error('Prepare encountered an error: recorder not prepared.')),
    true,
  );
  assert.equal(isRecorderSessionBusyError(new Error('The audio session is busy')), true);
});

test('does not treat the backend rate-limit copy as a native session error', () => {
  // That message is mapped in useVoiceRecognition to "Voice is busy — wait a few seconds".
  // Confusing it with a leftover recorder would retry forever against a 429.
  assert.equal(
    isRecorderSessionBusyError(new Error('Voice is busy — wait a few seconds and try that set again.')),
    false,
  );
  assert.equal(isRecorderSessionBusyError(new Error('Too many requests — slow down')), false);
});

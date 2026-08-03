import assert from 'node:assert/strict';
import test from 'node:test';

import { canRetryCoach, classifyCoachFailure, PRO_REQUIRED_CODE } from './coachFailure';

test('a paywall refusal is not retryable', () => {
  const kind = classifyCoachFailure({
    success: false,
    error: 'ONE MORE Pro subscription required',
    code: PRO_REQUIRED_CODE,
  });
  assert.equal(kind, 'entitlement');
  assert.equal(canRetryCoach(kind), false);
});

test('a paywall is still recognised when the backend sends no code', () => {
  const kind = classifyCoachFailure({
    success: false,
    error: 'ONE MORE Pro subscription required',
  });
  assert.equal(kind, 'entitlement');
});

test('a server or network failure is retryable', () => {
  assert.equal(canRetryCoach(classifyCoachFailure({ success: false, error: 'Network request failed' })), true);
  assert.equal(canRetryCoach(classifyCoachFailure({ success: false, error: 'Exercise prescription failed' })), true);
  assert.equal(canRetryCoach(classifyCoachFailure({ success: false, error: 'API error 500' })), true);
});

test('success is not a failure', () => {
  assert.equal(classifyCoachFailure({ success: true }), 'none');
  assert.equal(canRetryCoach('none'), false);
});

test('an unknown failure defaults to retryable rather than dead-ending the user', () => {
  assert.equal(classifyCoachFailure({ success: false }), 'transient');
});

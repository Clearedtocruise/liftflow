import assert from 'node:assert/strict';
import test from 'node:test';

import { canReopenSession, SESSION_REOPEN_GRACE_MS } from './sessionReopen';

test('a just-finished session can be reopened', () => {
  assert.equal(
    canReopenSession({ status: 'completed', endedAt: new Date().toISOString() }),
    true,
  );
});

test('a session finished within the grace window can be reopened', () => {
  const endedAt = new Date(Date.now() - SESSION_REOPEN_GRACE_MS / 2).toISOString();
  assert.equal(canReopenSession({ status: 'completed', endedAt }), true);
});

test('a session finished outside the grace window cannot be reopened', () => {
  const endedAt = new Date(Date.now() - SESSION_REOPEN_GRACE_MS - 1000).toISOString();
  assert.equal(canReopenSession({ status: 'completed', endedAt }), false);
});

test('an active or cancelled session is never "reopenable" — there is nothing to undo', () => {
  assert.equal(canReopenSession({ status: 'active', endedAt: null }), false);
  assert.equal(canReopenSession({ status: 'paused', endedAt: null }), false);
  assert.equal(canReopenSession({ status: 'cancelled', endedAt: new Date().toISOString() }), false);
});

test('a completed session missing ended_at is treated as reopenable rather than blocking the undo', () => {
  assert.equal(canReopenSession({ status: 'completed', endedAt: null }), true);
  assert.equal(canReopenSession({ status: 'completed', endedAt: undefined }), true);
});

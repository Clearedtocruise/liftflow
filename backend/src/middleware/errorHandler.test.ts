import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { apiErrorHandler } from './errorHandler.js';

import type { Request, Response } from 'express';

type Sent = { status?: number; body?: { message?: string; code?: string } };

function respond(err: unknown, headersSent = false): Sent {
  const sent: Sent = {};
  const res = {
    headersSent,
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: unknown) {
      sent.body = body as Sent['body'];
      return this;
    },
  } as unknown as Response;

  apiErrorHandler(err, { path: '/api/training/programs/import-pdf/preview', method: 'POST' } as Request, res, () => {});
  return sent;
}

/** What body-parser throws when a request exceeds the JSON limit. */
function tooLarge(): Error & { type: string; status: number } {
  return Object.assign(new Error('request entity too large'), {
    type: 'entity.too.large',
    status: 413,
  });
}

describe('apiErrorHandler', () => {
  it('answers an oversized upload with 413 rather than a server error', () => {
    const sent = respond(tooLarge());
    assert.equal(sent.status, 413);
    assert.equal(sent.body?.code, 'PAYLOAD_TOO_LARGE');
  });

  it('tells the reader what to do with the file instead of quoting HTTP at them', () => {
    const message = respond(tooLarge()).body?.message ?? '';
    assert.match(message, /paste the plan text/i);
    assert.doesNotMatch(message, /entity|request body/i);
  });

  it('reads an unparseable body as the caller\'s mistake, not the server\'s', () => {
    const sent = respond(Object.assign(new Error('Unexpected token'), { type: 'entity.parse.failed' }));
    assert.equal(sent.status, 400);
  });

  it('still reports a genuine failure as a 500 with its message', () => {
    const sent = respond(new Error('Supabase unreachable'));
    assert.equal(sent.status, 500);
    assert.equal(sent.body?.message, 'Supabase unreachable');
  });

  it('says nothing once a response has gone out', () => {
    assert.deepEqual(respond(new Error('too late'), true), {});
  });
});

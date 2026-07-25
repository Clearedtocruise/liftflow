import assert from 'node:assert/strict';
import test from 'node:test';

import { requireUser } from '../middleware/authUser.js';
import {
    audioFilename,
    MAX_AUDIO_BYTES,
    MIN_AUDIO_BYTES,
    TRANSCRIBE_MODEL,
    transcribeAudio,
    type Transcriber,
} from './voiceTranscription.js';

function audio(bytes: number): Buffer {
  return Buffer.alloc(bytes, 1);
}

const configured = () => true;

function stubTranscriber(text: string, calls: { model?: string; name?: string }[] = []): Transcriber {
  return async (file, model) => {
    calls.push({ model, name: (file as { name?: string }).name });
    return { text };
  };
}

test('transcribes a valid recording', async () => {
  const calls: { model?: string; name?: string }[] = [];
  const result = await transcribeAudio(
    audio(4096),
    'audio/m4a',
    stubTranscriber('  Bench press 225 for 8  ', calls),
    configured,
  );

  assert.deepEqual(result, { ok: true, transcript: 'Bench press 225 for 8' });
  assert.equal(calls[0]?.model, TRANSCRIBE_MODEL);
  assert.equal(calls[0]?.name, 'speech.m4a');
});

test('rejects missing audio without calling the provider', async () => {
  let called = false;
  const spy: Transcriber = async () => {
    called = true;
    return { text: 'should not happen' };
  };

  for (const body of [undefined, audio(0), audio(MIN_AUDIO_BYTES - 1)]) {
    const result = await transcribeAudio(body, 'audio/m4a', spy, configured);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
    assert.match(result.ok === false ? result.message : '', /No audio was recorded/);
  }

  assert.equal(called, false, 'empty audio must never reach the provider');
});

test('rejects an oversized recording with 413', async () => {
  const result = await transcribeAudio(
    audio(MAX_AUDIO_BYTES + 1),
    'audio/m4a',
    stubTranscriber('never used'),
    configured,
  );

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 413);
});

test('reports a clear 503 when no OpenAI key is configured', async () => {
  const result = await transcribeAudio(audio(4096), 'audio/m4a', stubTranscriber('hi'), () => false);

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 503);
  assert.match(result.ok === false ? result.message : '', /not configured/);
});

test('turns a provider failure into 502 rather than hanging or leaking detail', async () => {
  const thrower: Transcriber = async () => {
    throw new Error('ECONNRESET api.openai.com sk-secret-key-detail');
  };

  const result = await transcribeAudio(audio(4096), 'audio/m4a', thrower, configured);

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 502);
  assert.equal(result.ok === false && result.message.includes('sk-secret'), false);
});

test('treats a blank transcript as unheard speech, not success', async () => {
  for (const text of ['', '   ']) {
    const result = await transcribeAudio(audio(4096), 'audio/m4a', stubTranscriber(text), configured);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 422);
  }
});

test('audioFilename maps content types and falls back to m4a', () => {
  assert.equal(audioFilename('audio/wav'), 'speech.wav');
  assert.equal(audioFilename('audio/mp4; codecs=mp4a.40.2'), 'speech.mp4');
  assert.equal(audioFilename('AUDIO/WEBM'), 'speech.webm');
  assert.equal(audioFilename(undefined), 'speech.m4a');
  assert.equal(audioFilename('application/octet-stream'), 'speech.m4a');
});

// The route is mounted under `app.use('/api/voice', requireUser, ...)`, so this asserts the
// middleware it inherits actually refuses unauthenticated callers.
test('requireUser rejects a transcribe request with no bearer token', async () => {
  let status = 0;
  let payload: unknown = null;
  let nextCalled = false;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };

  await requireUser({ headers: {} } as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(status, 401);
  assert.deepEqual(payload, { message: 'Authorization required' });
  assert.equal(nextCalled, false);
});

console.log('voiceTranscription.test.ts — all assertions passed');

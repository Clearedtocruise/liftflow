import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_VISION_PDF_BYTES,
  TRANSCRIPTION_PROMPT,
  readPdfWithVision,
  transcriptionFromResponse,
} from './pdfVisionText.js';

const A_PLAN = [
  'Day 1 — Push',
  'Bench Press 4x8 @ 185',
  'Overhead Press 3x10',
  'Day 2 — Pull',
  'Barbell Row 4x8',
].join('\n');

describe('the transcription prompt', () => {
  it('asks for the page as written rather than a tidied-up version of it', () => {
    assert.match(TRANSCRIPTION_PROMPT, /own line/i);
    assert.match(TRANSCRIPTION_PROMPT, /exactly as printed/i);
  });

  it('forbids filling in a number that could not be read', () => {
    // A guessed weight is worse than a missing one: it looks like the plan and is not.
    assert.match(TRANSCRIPTION_PROMPT, /\[illegible\]/);
    assert.match(TRANSCRIPTION_PROMPT, /never round, convert, complete or infer/i);
  });

  it('treats the pages as data, not as instructions', () => {
    assert.match(TRANSCRIPTION_PROMPT, /untrusted data/i);
  });

  it('asks for the transcription alone, since a preamble would be parsed as part of the plan', () => {
    assert.match(TRANSCRIPTION_PROMPT, /no preamble/i);
  });
});

describe('transcriptionFromResponse', () => {
  it('takes the transcription as the plan text', () => {
    assert.equal(transcriptionFromResponse({ output_text: `${A_PLAN}\n` }), A_PLAN);
  });

  it('reads a refusal as nothing read', () => {
    // Handing this to the plan parser reports a plan with no days in it, which tells the reader
    // their file was fine and their plan was empty. Neither is true.
    assert.equal(transcriptionFromResponse({ output_text: "I'm sorry, I can't help." }), null);
  });

  it('reads an empty answer as nothing read', () => {
    assert.equal(transcriptionFromResponse({ output_text: '   ' }), null);
    assert.equal(transcriptionFromResponse({}), null);
  });

  it('caps a runaway transcription', () => {
    const long = transcriptionFromResponse({ output_text: 'Bench Press 4x8\n'.repeat(20_000) });
    assert.ok(long);
    assert.ok(long.length <= 60_000, `${long.length} characters came back`);
  });
});

describe('readPdfWithVision', () => {
  it('refuses a file too big to be worth reading page by page, before asking anyone', async () => {
    await assert.rejects(readPdfWithVision(Buffer.alloc(MAX_VISION_PDF_BYTES + 1)), (error: Error) => {
      assert.match(error.message, /too large|fewer pages/i);
      return true;
    });
  });

  it('stays under the ceiling the provider itself imposes', () => {
    assert.ok(MAX_VISION_PDF_BYTES < 50_000_000);
  });

  it('says what to do instead when there is no provider to read the pages', async () => {
    // The suite runs without a key, which is also how a self-hosted install without one behaves.
    await assert.rejects(readPdfWithVision(Buffer.from('%PDF-1.4')), (error: Error) => {
      assert.match(error.message, /paste the plan as text/i);
      return true;
    });
  });
});

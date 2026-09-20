/**
 * What the import tells someone when the AI read of their plan did not land.
 *
 * Reported from a real import: a 7-day plan came back "Parsed without AI — review carefully",
 * with nutrition targets but no meals. The server log for that minute reads
 * "[openai] chat completion failed: Request timed out." — the read was being held to the budget
 * meant for a line of coaching, so it never finished, and the message named the outcome without
 * naming the cause.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeChatFailure } from './openai.js';
import { parseProgramDocument, type AiDocumentRead } from './pdfProgramParse.js';

const PLAN = [
  'Day 1 — Push',
  'Bench Press 4x8',
  'Overhead Press 3x10',
  'Day 2 — Pull',
  'Barbell Row 4x8',
  'Pull Up 3x8',
  'Day 3 — Legs',
  'Back Squat 5x5',
  'Romanian Deadlift 3x10',
].join('\n');

const read = (result: AiDocumentRead) => async () => result;

const warningsFor = async (result: AiDocumentRead) =>
  (await parseProgramDocument({ text: PLAN, kind: 'workout', readWithAi: read(result) })).warnings;

describe('describeChatFailure', () => {
  it('recognises the SDK giving up on its own deadline', () => {
    assert.equal(describeChatFailure(new Error('Request timed out.')), 'timeout');
  });

  it('recognises a gateway that timed out upstream', () => {
    assert.equal(describeChatFailure(Object.assign(new Error('504'), { name: 'APIConnectionTimeoutError' })), 'timeout');
  });

  it('does not call every failure a timeout', () => {
    assert.equal(describeChatFailure(new Error('429 rate limit exceeded')), 'provider_error');
  });
});

describe('a plan read without the AI', () => {
  it('says the read timed out, and that trying again often works', async () => {
    const warnings = await warningsFor({ ok: false, reason: 'timeout' });
    assert.match(warnings[0], /took too long/i);
    assert.match(warnings[0], /read the plan again/i);
  });

  it('does not claim there was no AI when the AI simply did not answer in time', async () => {
    const warnings = await warningsFor({ ok: false, reason: 'timeout' });
    assert.ok(
      !warnings.some((warning) => /^parsed without ai/i.test(warning)),
      'the reader was told their plan was parsed without AI, which was not what happened',
    );
  });

  it('still hands back every day it could read for itself', async () => {
    const preview = await parseProgramDocument({
      text: PLAN,
      kind: 'workout',
      readWithAi: read({ ok: false, reason: 'timeout' }),
    });
    assert.equal(preview.workout?.days.filter((day) => !day.isRest).length, 3);
  });

  it('distinguishes an answer that came back unusable from one that never came', async () => {
    const warnings = await warningsFor({ ok: false, reason: 'unparseable' });
    assert.match(warnings[0], /unusable/i);
  });

  it('keeps the plain message when there is no AI configured at all', async () => {
    const warnings = await warningsFor({ ok: false, reason: 'no_provider' });
    assert.match(warnings[0], /^parsed without ai/i);
  });
});

describe('a plan the AI read less of than the document holds', () => {
  it('keeps the fuller parse without claiming the AI never ran', async () => {
    const preview = await parseProgramDocument({
      text: PLAN,
      kind: 'workout',
      readWithAi: read({
        ok: true,
        data: {
          workout: {
            name: 'Imported',
            lengthDays: 1,
            days: [{ label: 'Day 1', isRest: false, exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }] }],
          },
        },
      }),
    });

    assert.equal(preview.workout?.days.filter((day) => !day.isRest).length, 3, 'the fuller parse was dropped');
    assert.ok(
      !preview.warnings.some((warning) => /^parsed without ai/i.test(warning)),
      'the AI ran, so saying it did not is a lie about which parse to trust',
    );
    assert.ok(preview.warnings.some((warning) => /AI returned 1 training day/i.test(warning)));
  });
});

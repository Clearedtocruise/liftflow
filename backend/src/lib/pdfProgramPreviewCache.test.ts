import assert from 'node:assert/strict';
import test from 'node:test';

import { clearPreviewCache, previewProgramImport } from './pdfProgramImport.js';

const PLAN = [
  'Day 1 - Push',
  'Bench Press 4x8',
  'Overhead Press 3x10',
  'Day 2 - Pull',
  'Barbell Row 4x8',
  'Pull-ups 3x8',
].join('\n');

test('a second preview of the same plan joins the first instead of reading it again', async () => {
  clearPreviewCache();
  const source = { type: 'text', text: PLAN } as const;
  const [a, b] = await Promise.all([
    previewProgramImport(source, 'workout'),
    previewProgramImport(source, 'workout'),
  ]);
  assert.equal(a, b);
  assert.equal(await previewProgramImport(source, 'workout'), a);
});

test('a different day, kind or plan is read afresh', async () => {
  clearPreviewCache();
  const source = { type: 'text', text: PLAN } as const;
  const base = await previewProgramImport(source, 'workout', { today: '2026-10-16' });
  assert.notEqual(await previewProgramImport(source, 'workout', { today: '2026-10-17' }), base);
  assert.notEqual(await previewProgramImport({ type: 'text', text: `${PLAN}\nDay 3 - Legs\nSquat 5x5` }, 'workout', { today: '2026-10-16' }), base);
});

test('a failed read is not remembered', async () => {
  clearPreviewCache();
  const bad = { type: 'text', text: 'too short' } as const;
  await assert.rejects(previewProgramImport(bad, 'workout'));
  await assert.rejects(previewProgramImport(bad, 'workout'));
});

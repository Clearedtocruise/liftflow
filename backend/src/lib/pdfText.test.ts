import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractPdfText } from './pdfText.js';

const LINES = [
  'Day 1 - Push',
  'Bench Press 4x8',
  'Overhead Press 3x10',
  'Day 2 - Pull',
  'Barbell Row 4x8',
  'Pull Up 3x8',
  'Day 3 - Legs',
  'Back Squat 5x5',
  'Romanian Deadlift 3x10',
];

/**
 * A PDF with a classic cross-reference table — what most real exporters emit, and the shape whose
 * offsets can be damaged precisely.
 */
function buildPdf(): { pdf: string; offsets: number[] } {
  const content =
    'BT /F1 14 Tf 72 720 Td 18 TL\n' + LINES.map((line) => `(${line}) Tj T*`).join('\n') + '\nET\n';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return { pdf, offsets };
}

const bytes = (pdf: string) => Buffer.from(pdf, 'latin1');
const padded = (value: number) => String(value).padStart(10, '0');

async function readPlan(pdf: string) {
  const result = await extractPdfText(bytes(pdf));
  return { ...result, days: (result.text.match(/Day \d/g) ?? []).length };
}

describe('extractPdfText', () => {
  it('reads every line of an undamaged plan', async () => {
    const { pdf } = buildPdf();
    const { text } = await readPlan(pdf);
    for (const line of LINES) {
      assert.ok(text.includes(line), `missing "${line}"`);
    }
  });

  it('keeps each day heading on its own line so the plan parser can see it', async () => {
    const { pdf } = buildPdf();
    const { text } = await readPlan(pdf);
    assert.match(text, /^Day 1 - Push$/m);
    assert.match(text, /^Day 2 - Pull$/m);
  });

  // The user's "bad XRef entry": an offset pointing at the wrong byte. pdf.js rebuilds the index.
  it('reads a plan whose cross-reference table points at the wrong bytes', async () => {
    const { pdf, offsets } = buildPdf();
    const damaged = pdf.replace(`${padded(offsets[1])} 00000 n `, `${padded(offsets[1] + 7)} 00000 n `);
    const { days, text } = await readPlan(damaged);
    assert.equal(days, 3);
    assert.ok(text.includes('Bench Press 4x8'));
  });

  // The user's "Command token too long: 128": junk in the trailer, which pdf.js cannot route
  // around. The raw-stream scan does not read the trailer at all.
  it('reads a plan whose trailer is full of junk', async () => {
    const { pdf } = buildPdf();
    const at = pdf.indexOf('trailer');
    const damaged = `${pdf.slice(0, at)}trailer\n${'Q'.repeat(200)}\n${pdf.slice(at + 'trailer'.length)}`;
    const { days } = await readPlan(damaged);
    assert.equal(days, 3);
  });

  it('reads what was written of a file cut short mid-write', async () => {
    const { pdf } = buildPdf();
    const { days } = await readPlan(pdf.slice(0, pdf.indexOf('xref\n0 ')));
    assert.equal(days, 3);
  });

  it('reports recovery only when pdf.js could not open the file', async () => {
    const { pdf } = buildPdf();
    assert.equal((await readPlan(pdf)).recovered, false);
    assert.equal((await readPlan(pdf.slice(0, pdf.indexOf('xref\n0 ')))).recovered, true);
  });

  it('explains what to do instead of naming a PDF internal', async () => {
    // A well-formed shell with no text in it — nothing either pass can read.
    const empty = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n';
    await assert.rejects(extractPdfText(bytes(empty)), (error: Error) => {
      assert.match(error.message, /damaged or a scan|paste the plan as text/i);
      assert.doesNotMatch(error.message, /XRef|token too long/i);
      return true;
    });
  });

  it('rejects an empty file', async () => {
    await assert.rejects(extractPdfText(Buffer.alloc(0)), /empty/i);
  });
});

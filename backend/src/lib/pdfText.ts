/**
 * Extract plain text from a PDF buffer for program import.
 *
 * Uses pdf-parse's library entry (not the package root) — the root index runs a demo PDF
 * on import when NODE_ENV !== 'production', which breaks in tests/dev.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (data: Buffer) => Promise<{
  text?: string;
  numpages?: number;
}>;

const MIN_USEFUL_CHARS = 80;
const MAX_EXTRACT_CHARS = 60_000;

export type PdfTextResult = {
  text: string;
  pageCount: number;
  truncated: boolean;
};

export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  if (!buffer?.length) {
    throw new Error('PDF file is empty');
  }
  const parsed = await pdfParse(buffer);
  const raw = (parsed.text ?? '').replace(/\u0000/g, '').trim();
  const truncated = raw.length > MAX_EXTRACT_CHARS;
  const text = truncated ? raw.slice(0, MAX_EXTRACT_CHARS) : raw;
  return {
    text,
    pageCount: typeof parsed.numpages === 'number' ? parsed.numpages : 0,
    truncated,
  };
}

export function assertUsefulPdfText(text: string): void {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length < MIN_USEFUL_CHARS) {
    throw new Error(
      'Could not read enough text from this PDF. Try a text-based PDF (not a scan), or paste the plan as text.',
    );
  }
}

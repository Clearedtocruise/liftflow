/**
 * Extract plain text from a PDF buffer for program import.
 *
 * Real plans arrive from whatever exported them, and a surprising number are damaged: a stale
 * cross-reference offset, a file cut short mid-write, a run of junk in the trailer. So this reads
 * in three passes, each tolerating more damage than the last:
 *
 *  1. pdf.js, which rebuilds the object index itself when the cross-reference table lies.
 *  2. Failing that, a scan of the raw bytes for content streams, which needs neither a valid
 *     cross-reference table nor a trailer — enough to read a file pdf.js cannot open at all.
 *  3. Failing that, a message naming what the reader can do about it.
 *
 * A page that throws is skipped rather than failing the import: most of a plan beats none of it.
 *
 * None of that helps a file with no words in it — a scan, or a photo of a printout. For those,
 * {@link readPlanPdfText} reads the pages instead of the file.
 */

import { createRequire } from 'module';
import { constants as zlibConstants, inflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);

const MIN_USEFUL_CHARS = 80;
const MAX_EXTRACT_CHARS = 60_000;

/** Salvage only: a stream run this long is an image, not a page of text. */
const MAX_SALVAGED_STREAM_BYTES = 4_000_000;
const MAX_SALVAGED_STREAMS = 800;

/**
 * Salvaged text is only trusted when it is mostly ordinary characters. A font with a custom
 * encoding and no ToUnicode map salvages as consistent gibberish, which would otherwise reach the
 * plan parser looking like content.
 */
const MIN_PRINTABLE_RATIO = 0.85;

export type PdfTextResult = {
  text: string;
  pageCount: number;
  truncated: boolean;
  /** True when the text came from the raw-stream scan because pdf.js could not open the file. */
  recovered: boolean;
};

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJsModule> | undefined;

function loadPdfJs(): Promise<PdfJsModule> {
  // Imported on first use, not at module load: it is a large library on a route most requests
  // never touch, and importing it eagerly would cost every cold start.
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

/** Where pdf.js keeps the fonts it falls back to when a document does not embed its own. */
function standardFontDataUrl(): string {
  const packageJson = require.resolve('pdfjs-dist/package.json');
  return `${packageJson.slice(0, packageJson.lastIndexOf('/'))}/standard_fonts/`;
}

/**
 * Join the text items of one page into lines.
 *
 * Items carry a position, not a line: a new line is where the baseline moves. This is the rule the
 * plan parser was written against, and it is what keeps "Day 1 — Push" a heading of its own rather
 * than a run-on with the exercise beneath it.
 */
function linesFromTextItems(items: readonly unknown[]): string {
  let text = '';
  let lastY: number | undefined;
  for (const item of items) {
    const entry = item as { str?: string; transform?: number[] };
    if (typeof entry.str !== 'string') continue;
    const y = entry.transform?.[5];
    if (lastY !== undefined && y !== lastY) text += '\n';
    text += entry.str;
    lastY = y;
  }
  return text;
}

async function readWithPdfJs(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({
    // pdf.js transfers ownership of the array it is given, so hand it a copy — the caller still
    // needs these bytes for the salvage pass if this one comes back empty.
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    standardFontDataUrl: standardFontDataUrl(),
    // A damaged page should cost us that page, not the document.
    stopAtErrors: false,
  }).promise;

  try {
    const pages: string[] = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= doc.numPages && total < MAX_EXTRACT_CHARS; pageNumber += 1) {
      try {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = linesFromTextItems(content.items);
        total += pageText.length;
        pages.push(pageText);
        page.cleanup();
      } catch {
        // Skip this page and keep going: a plan missing one page still imports.
      }
    }
    return { text: pages.join('\n'), pageCount: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

/** Read a PDF literal string starting at the opening paren, honouring escapes and nesting. */
function readLiteralString(source: string, openAt: number): { value: string; end: number } {
  let value = '';
  let depth = 1;
  let index = openAt + 1;

  while (index < source.length && depth > 0) {
    const char = source[index];

    if (char === '\\') {
      const escaped = source[index + 1];
      index += 2;
      switch (escaped) {
        case 'n': value += '\n'; break;
        case 'r': value += '\r'; break;
        case 't': value += '\t'; break;
        case 'b': case 'f': value += ' '; break;
        case '\n': break;
        case '\r': if (source[index] === '\n') index += 1; break;
        default:
          if (escaped >= '0' && escaped <= '7') {
            let octal = escaped;
            while (octal.length < 3 && source[index] >= '0' && source[index] <= '7') {
              octal += source[index];
              index += 1;
            }
            value += String.fromCharCode(Number.parseInt(octal, 8));
          } else {
            value += escaped ?? '';
          }
      }
      continue;
    }

    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;

    if (depth > 0) value += char;
    index += 1;
  }

  return { value, end: index };
}

function readHexString(source: string, openAt: number): { value: string; end: number } {
  const close = source.indexOf('>', openAt);
  if (close < 0) return { value: '', end: source.length };
  const digits = source.slice(openAt + 1, close).replace(/[^0-9a-f]/gi, '');
  let value = '';
  for (let index = 0; index + 1 < digits.length; index += 2) {
    value += String.fromCharCode(Number.parseInt(digits.slice(index, index + 2), 16));
  }
  return { value, end: close + 1 };
}

/**
 * Pull the shown text out of one content stream.
 *
 * This reads only the text-showing operators and the ones that move the cursor to a new line. It
 * is not a renderer: no fonts, no encodings, no positioning. Against a healthy document pdf.js
 * does this far better — this exists for the documents pdf.js will not open.
 */
function textFromContentStream(content: string): string {
  let out = '';
  let pending = '';
  let index = 0;

  const flush = () => {
    if (pending) out += pending;
    pending = '';
  };

  while (index < content.length) {
    const char = content[index];

    if (char === '(') {
      const { value, end } = readLiteralString(content, index);
      pending += value;
      index = end;
      continue;
    }

    if (char === '<' && content[index + 1] !== '<') {
      const { value, end } = readHexString(content, index);
      pending += value;
      index = end;
      continue;
    }

    const operator = /^(TJ|Tj|T\*|Td|TD|ET|'|")/.exec(content.slice(index, index + 2));
    if (operator) {
      const token = operator[1];
      if (token === 'TJ' || token === 'Tj') {
        flush();
      } else if (token === "'" || token === '"') {
        out += '\n';
        flush();
      } else if (token === 'T*' || token === 'Td' || token === 'TD' || token === 'ET') {
        flush();
        out += '\n';
      }
      index += token.length;
      continue;
    }

    index += 1;
  }

  flush();
  return out;
}

function printableRatio(text: string): number {
  if (!text.length) return 0;
  // eslint-disable-next-line no-control-regex
  const printable = text.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u024f\u2010-\u2027]/g, '');
  return printable.length / text.length;
}

/**
 * Last resort: find content streams by scanning the bytes, ignoring the cross-reference table and
 * trailer entirely. Streams are inflated with a sync flush so a file cut short mid-write still
 * gives up the part that did get written.
 */
function salvageTextFromRawStreams(buffer: Buffer): string {
  const bytes = buffer.toString('latin1');
  const pieces: string[] = [];
  let searchFrom = 0;
  let streamsSeen = 0;
  let salvaged = 0;

  while (streamsSeen < MAX_SALVAGED_STREAMS && salvaged < MAX_EXTRACT_CHARS) {
    const keyword = bytes.indexOf('stream', searchFrom);
    if (keyword < 0) break;

    // "endstream" also contains "stream"; skip those and anything not at a token boundary.
    const before = bytes[keyword - 1];
    if (before && /[a-zA-Z]/.test(before)) {
      searchFrom = keyword + 6;
      continue;
    }

    let start = keyword + 'stream'.length;
    if (bytes[start] === '\r') start += 1;
    if (bytes[start] === '\n') start += 1;

    const end = bytes.indexOf('endstream', start);
    const stop = end < 0 ? Math.min(bytes.length, start + MAX_SALVAGED_STREAM_BYTES) : end;
    searchFrom = end < 0 ? bytes.length : end + 'endstream'.length;
    streamsSeen += 1;
    if (stop - start > MAX_SALVAGED_STREAM_BYTES) continue;

    const raw = Buffer.from(bytes.slice(start, stop), 'latin1');
    let content: string | undefined;
    try {
      // Z_SYNC_FLUSH rather than the default: a truncated stream returns what it has instead of
      // throwing, which is the whole point of this pass.
      content = inflateSync(raw, { finishFlush: zlibConstants.Z_SYNC_FLUSH }).toString('latin1');
    } catch {
      // Not deflated (or not deflate at all) — an uncompressed content stream reads as-is.
      content = /\bTj\b|\bTJ\b/.test(raw.toString('latin1')) ? raw.toString('latin1') : undefined;
    }
    if (!content) continue;

    const text = textFromContentStream(content);
    if (!text.trim()) continue;
    pieces.push(text);
    salvaged += text.length;
  }

  const joined = pieces.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return printableRatio(joined) >= MIN_PRINTABLE_RATIO ? joined : '';
}

function looksUseful(text: string): boolean {
  return text.replace(/\s+/g, ' ').trim().length >= MIN_USEFUL_CHARS;
}

function finish(text: string, pageCount: number, recovered: boolean): PdfTextResult {
  const raw = text.replace(/\u0000/g, '').trim();
  const truncated = raw.length > MAX_EXTRACT_CHARS;
  return {
    text: truncated ? raw.slice(0, MAX_EXTRACT_CHARS) : raw,
    pageCount,
    truncated,
    recovered,
  };
}

export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  if (!buffer?.length) {
    throw new Error('PDF file is empty');
  }

  let pageCount = 0;
  try {
    const parsed = await readWithPdfJs(buffer);
    pageCount = parsed.pageCount;
    if (looksUseful(parsed.text)) return finish(parsed.text, pageCount, false);
  } catch {
    // Structural damage pdf.js cannot route around. The raw scan does not need the structure.
  }

  const salvaged = salvageTextFromRawStreams(buffer);
  if (looksUseful(salvaged)) return finish(salvaged, pageCount, true);

  throw new Error(
    'Could not read this PDF — it may be damaged or a scan. Try exporting or printing it to PDF ' +
      'again, or paste the plan as text.',
  );
}

export type PlanTextResult = PdfTextResult & {
  /** True when the words came from reading the pages as images rather than out of the file. */
  transcribed: boolean;
};

/**
 * The plan text of a PDF, however it has to be got at.
 *
 * {@link extractPdfText} handles every file with words in it, damaged or not. What it cannot help
 * with is a file with no words in it at all — a scan, or a photo of a printout — where there is
 * nothing to extract and the pages have to be read instead.
 *
 * The reader is injectable so the decision to fall back can be tested without a provider.
 */
export async function readPlanPdfText(
  buffer: Buffer,
  options?: {
    fileName?: string;
    transcribe?: (buffer: Buffer, fileName?: string) => Promise<string>;
  },
): Promise<PlanTextResult> {
  try {
    const extracted = await extractPdfText(buffer);
    if (looksUseful(extracted.text)) return { ...extracted, transcribed: false };
  } catch (error) {
    // An empty file is empty whoever reads it, and a vision call would only bill for saying so.
    if (!buffer?.length) throw error;
  }

  const transcribe = options?.transcribe ?? (await import('./pdfVisionText.js')).readPdfWithVision;
  const text = await transcribe(buffer, options?.fileName);
  return { ...finish(text, 0, false), transcribed: true };
}

export function assertUsefulPdfText(text: string): void {
  if (!looksUseful(text)) {
    throw new Error(
      'Could not read enough text from this PDF. Try a text-based PDF (not a scan), or paste the plan as text.',
    );
  }
}

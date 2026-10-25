/**
 * PDF / text program import orchestrator — preview then commit into existing sinks.
 */

import { createHash } from 'node:crypto';

import { applyImportedNutritionPlan } from './importedNutritionPlan.js';
import {
  MAX_AI_PARSE_MS,
  parseProgramDocument,
  type ImportKind,
  type ProgramImportPreview,
} from './pdfProgramParse.js';
import { detectPlanStartDay } from './planCalendar.js';
import { assertUsefulPdfText, readPlanPdfText } from './pdfText.js';
import { createOrReplaceCycle, type CycleStatus } from './programCycleService.js';
import type { ApplyImportedNutritionResult } from './importedNutritionPlan.js';

export type ImportSource =
  | { type: 'pdf'; base64: string; fileName?: string }
  | { type: 'text'; text: string; fileName?: string };

export type ProgramImportCommitResult = {
  preview: ProgramImportPreview;
  workout: CycleStatus | null;
  nutrition: ApplyImportedNutritionResult | null;
};

/** Reading the words out of a file is seconds of work; longer means the file is fighting the reader. */
export const PDF_READ_DEADLINE_MS = 25_000;

export async function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function decodePdfBase64(base64: string): Buffer {
  const cleaned = base64.replace(/^data:application\/pdf;base64,/i, '').replace(/\s+/g, '');
  if (!cleaned) throw new Error('PDF payload is empty');
  const buffer = Buffer.from(cleaned, 'base64');
  if (buffer.length < 100) throw new Error('PDF payload is too small to be valid');
  // %PDF magic
  if (buffer.subarray(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('File does not look like a PDF');
  }
  return buffer;
}

export async function resolveImportText(source: ImportSource): Promise<{
  text: string;
  fileName?: string;
  pageCount?: number;
  /** The file was damaged and the text came from a best-effort scan rather than a clean read. */
  recovered?: boolean;
  /** The file had no text in it, so the pages were read as images. */
  transcribed?: boolean;
}> {
  if (source.type === 'text') {
    const text = source.text.trim();
    if (text.length < 40) throw new Error('Paste more of the plan text (at least a few lines).');
    return { text, fileName: source.fileName };
  }
  const buffer = decodePdfBase64(source.base64);
  const extracted = await withDeadline(
    readPlanPdfText(buffer, { fileName: source.fileName }),
    PDF_READ_DEADLINE_MS,
    'Reading this PDF took too long. Print it to a new PDF, or paste the plan as text.',
  );
  assertUsefulPdfText(extracted.text);
  return {
    text: extracted.text,
    fileName: source.fileName,
    pageCount: extracted.pageCount,
    recovered: extracted.recovered,
    transcribed: extracted.transcribed,
  };
}

/**
 * What the reader should know about how the words were got out of their file, before they read
 * the days below them. Both of these mean "this came out of a file that fought us" — the review
 * step is there either way, but these are the two times it really matters.
 */
function sourceWarnings(resolved: { recovered?: boolean; transcribed?: boolean }): string[] {
  if (resolved.transcribed) {
    return [
      'This PDF had no text in it, so we read the pages as images. Check every day, set and rep ' +
        'below before applying.',
    ];
  }
  if (resolved.recovered) {
    return ['This PDF was damaged, so we read what we could of it. Check the days below before applying.'];
  }
  return [];
}

/**
 * How long the whole preview may take before the phone gives up on it.
 *
 * Getting the words out of the file costs time of its own, and whatever it costs has to come out
 * of the same minute the reader is willing to wait. Spending part of that on extraction and then
 * starting a fresh full-length read is how an import ends in a network error instead of a plan.
 *
 * Reading a scan is the expensive case: transcribing the pages and then reading the plan out of
 * that transcription are two model calls inside this one budget.
 */
const PREVIEW_BUDGET_MS = 80_000;

/** Never bother the model with less time than a plan takes to read; go straight to the fallback. */
const MIN_AI_PARSE_MS = 10_000;

type PreviewResult = ProgramImportPreview & { pageCount?: number };

const PREVIEW_CACHE_TTL_MS = 10 * 60_000;
const PREVIEW_CACHE_MAX = 8;
const previewCache = new Map<string, { at: number; result: Promise<PreviewResult> }>();

export function clearPreviewCache(): void {
  previewCache.clear();
}

function previewCacheKey(source: ImportSource, kind: ImportKind, today?: string): string {
  const content = source.type === 'pdf' ? source.base64 : source.text;
  return createHash('sha256').update(JSON.stringify([source.type, kind, today ?? '', content])).digest('hex');
}

/**
 * A preview takes most of a minute on a long plan, and a phone changing networks mid-request drops
 * the connection while the server carries on to the end. Without this the retry starts the whole
 * read again; with it the retry joins the read already running, or collects the finished one.
 * Only a clean read is kept: a read that fell back because the model was unavailable is worth
 * trying again.
 */
export async function previewProgramImport(
  source: ImportSource,
  kind: ImportKind,
  options?: { today?: string },
): Promise<PreviewResult> {
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (now - entry.at > PREVIEW_CACHE_TTL_MS) previewCache.delete(key);
  }

  const key = previewCacheKey(source, kind, options?.today);
  const cached = previewCache.get(key);
  if (cached) {
    console.info(`[import-pdf] preview ${source.type} kind=${kind} served from a read already done or running`);
    return cached.result;
  }

  const result = previewProgramImportUncached(source, kind, options);
  previewCache.set(key, { at: now, result });
  while (previewCache.size > PREVIEW_CACHE_MAX) {
    const oldest = previewCache.keys().next().value;
    if (oldest === undefined) break;
    previewCache.delete(oldest);
  }
  try {
    const finished = await result;
    if (finished.warnings.some((warning) => /AI read of this plan|could not be read by the AI/.test(warning))) previewCache.delete(key);
  } catch (error) {
    previewCache.delete(key);
    throw error;
  }
  return result;
}

async function previewProgramImportUncached(
  source: ImportSource,
  kind: ImportKind,
  options?: { today?: string },
): Promise<PreviewResult> {
  const startedAt = Date.now();
  const resolved = await resolveImportText(source);
  const extractedMs = Date.now() - startedAt;
  const remaining = PREVIEW_BUDGET_MS - extractedMs;
  const preview = await parseProgramDocument({
    text: resolved.text,
    kind,
    fileName: resolved.fileName,
    timeoutMs: Math.min(Math.max(remaining, MIN_AI_PARSE_MS), MAX_AI_PARSE_MS),
  });
  const warnings = [...sourceWarnings(resolved), ...preview.warnings];

  // A plan that prints its own calendar says which session today is. Without it the cycle starts
  // on Day 1, which shifts every day by one for anyone importing mid-plan.
  const dayCount = preview.workout?.days.length ?? 0;
  const calendar =
    options?.today && dayCount > 0 ? detectPlanStartDay(resolved.text, options.today, dayCount) : null;
  console.info(
    `[import-pdf] preview ${source.type} kind=${kind} pages=${resolved.pageCount ?? '-'} ` +
      `chars=${resolved.text.length} extract=${extractedMs}ms total=${Date.now() - startedAt}ms`,
  );
  return {
    ...preview,
    warnings,
    pageCount: resolved.pageCount,
    ...(calendar ? { startDay: calendar.day, startDayLabel: calendar.label } : {}),
  };
}

export async function commitProgramImport(options: {
  userId: string;
  source?: ImportSource;
  kind: ImportKind;
  preview?: ProgramImportPreview;
  timeZone?: string | null;
  /** Which cycle day today is. Overrides what the document's calendar suggested. */
  startDay?: number;
}): Promise<ProgramImportCommitResult> {
  const { userId, kind, timeZone } = options;
  const startedAt = Date.now();
  const preview =
    options.preview ??
    (options.source
      ? await previewProgramImport(options.source, kind)
      : (() => {
          throw new Error('preview or source is required');
        })());

  let workout: CycleStatus | null = null;
  let nutrition: ApplyImportedNutritionResult | null = null;

  const wantWorkout = kind === 'workout' || kind === 'both';
  const wantNutrition = kind === 'nutrition' || kind === 'both';

  const startDay =
    Number.isFinite(options.startDay) && Number(options.startDay) >= 1
      ? Math.round(Number(options.startDay))
      : (preview.startDay ?? 1);

  if (wantWorkout && preview.workout && preview.workout.days.length > 0) {
    workout = await createOrReplaceCycle(userId, { ...preview.workout, startDay }, timeZone);
  }

  if (wantNutrition && preview.nutrition) {
    nutrition = await applyImportedNutritionPlan(userId, preview.nutrition, { startDay });
  }

  if (!workout && !nutrition) {
    if (wantWorkout && !wantNutrition) {
      throw new Error('No workout program to apply. Re-parse the document or choose Nutrition only.');
    }
    if (wantNutrition && !wantWorkout) {
      throw new Error('No nutrition plan to apply. Re-parse the document or choose Workout only.');
    }
    throw new Error('Nothing to apply from this document. Re-parse or adjust the PDF/text.');
  }

  console.info(
    `[import-pdf] commit kind=${kind} workout=${workout ? 'yes' : 'no'} ` +
      `nutrition=${nutrition ? nutrition.mealsInserted : 'no'} total=${Date.now() - startedAt}ms`,
  );
  return { preview, workout, nutrition };
}

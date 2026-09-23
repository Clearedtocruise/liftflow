/**
 * PDF / text program import orchestrator — preview then commit into existing sinks.
 */

import { applyImportedNutritionPlan } from './importedNutritionPlan.js';
import {
  MAX_AI_PARSE_MS,
  parseProgramDocument,
  type ImportKind,
  type ProgramImportPreview,
} from './pdfProgramParse.js';
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
  const extracted = await readPlanPdfText(buffer, { fileName: source.fileName });
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
const PREVIEW_BUDGET_MS = 52_000;

/** Never bother the model with less time than a plan takes to read; go straight to the fallback. */
const MIN_AI_PARSE_MS = 10_000;

export async function previewProgramImport(
  source: ImportSource,
  kind: ImportKind,
): Promise<ProgramImportPreview & { pageCount?: number }> {
  const startedAt = Date.now();
  const resolved = await resolveImportText(source);
  const remaining = PREVIEW_BUDGET_MS - (Date.now() - startedAt);
  const preview = await parseProgramDocument({
    text: resolved.text,
    kind,
    fileName: resolved.fileName,
    timeoutMs: Math.min(Math.max(remaining, MIN_AI_PARSE_MS), MAX_AI_PARSE_MS),
  });
  const warnings = [...sourceWarnings(resolved), ...preview.warnings];
  return { ...preview, warnings, pageCount: resolved.pageCount };
}

export async function commitProgramImport(options: {
  userId: string;
  source?: ImportSource;
  kind: ImportKind;
  preview?: ProgramImportPreview;
  timeZone?: string | null;
}): Promise<ProgramImportCommitResult> {
  const { userId, kind, timeZone } = options;
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

  if (wantWorkout && preview.workout && preview.workout.days.length > 0) {
    workout = await createOrReplaceCycle(userId, preview.workout, timeZone);
  }

  if (wantNutrition && preview.nutrition) {
    nutrition = await applyImportedNutritionPlan(userId, preview.nutrition);
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

  return { preview, workout, nutrition };
}

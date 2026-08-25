/**
 * PDF / text program import orchestrator — preview then commit into existing sinks.
 */

import { applyImportedNutritionPlan } from './importedNutritionPlan.js';
import {
  parseProgramDocument,
  type ImportKind,
  type ProgramImportPreview,
} from './pdfProgramParse.js';
import { assertUsefulPdfText, extractPdfText } from './pdfText.js';
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
}> {
  if (source.type === 'text') {
    const text = source.text.trim();
    if (text.length < 40) throw new Error('Paste more of the plan text (at least a few lines).');
    return { text, fileName: source.fileName };
  }
  const buffer = decodePdfBase64(source.base64);
  const extracted = await extractPdfText(buffer);
  assertUsefulPdfText(extracted.text);
  return { text: extracted.text, fileName: source.fileName, pageCount: extracted.pageCount };
}

export async function previewProgramImport(
  source: ImportSource,
  kind: ImportKind,
): Promise<ProgramImportPreview & { pageCount?: number }> {
  const resolved = await resolveImportText(source);
  const preview = await parseProgramDocument({
    text: resolved.text,
    kind,
    fileName: resolved.fileName,
  });
  return { ...preview, pageCount: resolved.pageCount };
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

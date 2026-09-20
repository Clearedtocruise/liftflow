/**
 * How big a plan PDF can be before the reader will not take it.
 *
 * The file travels as base64 inside a JSON body, and the API caps that body. Base64 spends four
 * bytes on every three, so the file itself has to fit inside three quarters of the cap, with a
 * little left over for the rest of the request.
 *
 * Coaches export plans with a photo on every exercise, which is how a six-page program becomes
 * twenty megabytes. Caught here, that file is named and the reader is told what to do about it;
 * sent anyway, it comes back as a rejected request whose message is about HTTP.
 */

/** Must not exceed the `express.json` limit on the API, less the base64 overhead. */
export const MAX_IMPORT_PDF_BYTES = 8_500_000;

export function formatFileSize(bytes: number): string {
  const mb = bytes / 1_000_000;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

/** The size of the file behind a base64 payload, which is four bytes per three of the original. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Why this file cannot be read, or null when it can be.
 *
 * An unknown size is not an objection: some pickers do not report one, and the API refuses an
 * oversized upload on its own.
 */
export function oversizedPdfMessage(bytes: number | undefined | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= MAX_IMPORT_PDF_BYTES) return null;
  return (
    `This PDF is ${formatFileSize(bytes)} — more than the ${formatFileSize(MAX_IMPORT_PDF_BYTES)} the ` +
    'reader takes. Most of that is usually images. Export the plan as text-only, print just the ' +
    'pages with the program on them, or paste the plan text below.'
  );
}

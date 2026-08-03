import { toFile } from 'openai';

import { getOpenAI, hasOpenAI } from './openai.js';

/**
 * Roughly 4 minutes of the client's m4a preset. Large enough that no realistic set-logging
 * utterance is rejected, small enough that a runaway recorder cannot pin backend memory.
 */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/** Below this a "recording" is a container header with no samples — the mic never opened. */
export const MIN_AUDIO_BYTES = 1024;

/**
 * gpt-4o-transcribe over whisper-1: same endpoint in openai@6, materially better on gym
 * vocabulary ("RDL", "incline dumbbell") and on short utterances cut off mid-word.
 */
export const TRANSCRIBE_MODEL = 'gpt-4o-transcribe';

const EXTENSIONS: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

/**
 * The provider infers the codec from the filename, so an unknown content type must still get a
 * plausible extension rather than none — m4a is what both client recorders produce by default.
 */
export function audioFilename(contentType: string | undefined): string {
  const base = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return `speech.${EXTENSIONS[base] ?? 'm4a'}`;
}

export type TranscribeSuccess = { ok: true; transcript: string };
export type TranscribeFailure = { ok: false; status: number; message: string };
export type TranscribeResult = TranscribeSuccess | TranscribeFailure;

/** Injected in tests so the failure paths are exercised without a provider round trip. */
export type Transcriber = (file: Awaited<ReturnType<typeof toFile>>, model: string) => Promise<{ text?: string }>;

async function defaultTranscriber(file: Awaited<ReturnType<typeof toFile>>, model: string) {
  const openai = getOpenAI();
  if (!openai) throw new Error('OpenAI client unavailable');
  return openai.audio.transcriptions.create({ file, model, response_format: 'json' });
}

/**
 * Every branch returns a status plus a message written for the user, because a voice button that
 * fails silently is indistinguishable from one that is still thinking.
 */
export async function transcribeAudio(
  audio: Uint8Array | Buffer | undefined,
  contentType: string | undefined,
  transcriber: Transcriber = defaultTranscriber,
  providerConfigured: () => boolean = hasOpenAI,
): Promise<TranscribeResult> {
  if (!audio || audio.byteLength < MIN_AUDIO_BYTES) {
    return { ok: false, status: 400, message: 'No audio was recorded. Tap the mic and speak your set.' };
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, message: 'That recording is too long. Try a shorter phrase.' };
  }
  if (!providerConfigured()) {
    return { ok: false, status: 503, message: 'Voice transcription is not configured on the server.' };
  }

  let result: { text?: string };
  try {
    const file = await toFile(Buffer.from(audio), audioFilename(contentType), {
      type: contentType ?? 'audio/m4a',
    });
    result = await transcriber(file, TRANSCRIBE_MODEL);
  } catch (error) {
    console.error('[voice/transcribe] provider failed:', error instanceof Error ? error.message : error);
    return { ok: false, status: 502, message: 'Could not reach the transcription service. Try again.' };
  }

  const transcript = (result?.text ?? '').trim();
  if (!transcript) {
    return { ok: false, status: 422, message: "Didn't catch that. Try again a little closer to the mic." };
  }

  return { ok: true, transcript };
}

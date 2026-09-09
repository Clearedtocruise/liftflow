/**
 * Turns a failed voice request into one honest sentence.
 *
 * Every failure used to be matched by substring, so anything that merely mentioned a rate limit —
 * a refused token, a stalled upload — was reported as "Voice is busy", which is both wrong and
 * unactionable. The HTTP status and the server's error code decide here; text is only a fallback
 * for errors that never reached the API client.
 */

export const VOICE_BUSY_MESSAGE = 'Voice is busy — wait a few seconds and try again.';
export const VOICE_SIGNED_OUT_MESSAGE = 'Sign in again to log sets by voice.';
export const VOICE_OFFLINE_MESSAGE = "No connection — that set didn't send. Try again.";
export const VOICE_GENERIC_MESSAGE = 'Could not transcribe that. Try again.';

/** The longest cooldown worth showing: the server's windows are a minute wide. */
const MAX_RETRY_SECONDS = 60;

export type VoiceFailure = {
  /** HTTP status, when the request reached the backend. */
  status?: number;
  /** Backend error code, e.g. VOICE_RATE_LIMITED. */
  code?: string;
  message: string;
  /** Seconds the server asked us to wait, from Retry-After. */
  retryAfterSeconds?: number;
};

/** Structural read of an ApiError so this module stays free of React Native imports. */
export function toVoiceFailure(error: unknown): VoiceFailure {
  const candidate = error as Partial<VoiceFailure> | null | undefined;
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  const code = typeof candidate?.code === 'string' ? candidate.code : undefined;
  const retryAfterSeconds =
    typeof candidate?.retryAfterSeconds === 'number' && Number.isFinite(candidate.retryAfterSeconds)
      ? candidate.retryAfterSeconds
      : undefined;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  return { status, code, message, retryAfterSeconds };
}

export function isThrottled(failure: VoiceFailure): boolean {
  if (failure.status !== undefined) return failure.status === 429;
  if (failure.code) return failure.code.includes('RATE_LIMITED');

  // No status means the throw never came from the API client; fall back to the wording.
  const lower = failure.message.toLowerCase();
  return (
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('voice is busy')
  );
}

/** How long the mic should stay out of the way, in ms. Zero when the failure was not a throttle. */
export function voiceCooldownMs(failure: VoiceFailure): number {
  if (!isThrottled(failure)) return 0;
  const seconds = Math.min(Math.max(Math.ceil(failure.retryAfterSeconds ?? 0), 0), MAX_RETRY_SECONDS);
  return seconds * 1000;
}

export function throttledMessage(secondsRemaining?: number): string {
  if (secondsRemaining === undefined || !Number.isFinite(secondsRemaining) || secondsRemaining <= 0) {
    return VOICE_BUSY_MESSAGE;
  }
  return `Voice is busy — try again in ${Math.min(Math.ceil(secondsRemaining), MAX_RETRY_SECONDS)}s.`;
}

function isOffline(failure: VoiceFailure): boolean {
  if (failure.status !== undefined) return false;
  const lower = failure.message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error')
  );
}

export function voiceFailureMessage(failure: VoiceFailure): string {
  if (isThrottled(failure)) return throttledMessage(failure.retryAfterSeconds);
  if (failure.status === 401 || failure.status === 403) return VOICE_SIGNED_OUT_MESSAGE;
  if (isOffline(failure)) return VOICE_OFFLINE_MESSAGE;
  // Backend failures already carry copy written for the lifter ("Didn't catch that…").
  return failure.message.trim() || VOICE_GENERIC_MESSAGE;
}

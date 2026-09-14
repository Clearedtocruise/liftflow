/**
 * End-of-speech detection from expo-av metering (dBFS, roughly -160 silence → 0 loud).
 * Pure reducer so gym-floor timing can be unit-tested without a mic.
 */

export type EndOfSpeechConfig = {
  /** dB at/above which we treat the frame as speech. */
  speechThresholdDb: number;
  /** dB at/below which we treat the frame as silence (hysteresis below speech). */
  silenceThresholdDb: number;
  /** How long silence must last after speech before we stop. */
  endSilenceMs: number;
  /** Never auto-stop before this — avoids cutting the first syllable. */
  minRecordingMs: number;
  /** If the user never speaks, stop so music is not ducked forever. */
  noSpeechTimeoutMs: number;
  /**
   * Fallback cap for devices that never report metering at all. Without a level to read there is
   * no end-of-speech signal, so the take used to run to the hard cap — fifteen seconds of open mic
   * after a two-second sentence, which is indistinguishable from voice logging being broken.
   */
  noMeteringStopMs: number;
};

export const DEFAULT_END_OF_SPEECH: EndOfSpeechConfig = {
  /** Gym floors are noisy but speech is quieter than music — slightly more sensitive. */
  speechThresholdDb: -42,
  silenceThresholdDb: -50,
  endSilenceMs: 1400,
  minRecordingMs: 700,
  /**
   * Disabled in practice (see reduceEndOfSpeech): auto-stopping on "no speech" while metering
   * reports silence cut captures before the lifter finished — music unducked, empty transcript.
   * Hard MAX_RECORDING_MS / a second tap end the take instead.
   */
  noSpeechTimeoutMs: Number.POSITIVE_INFINITY,
  noMeteringStopMs: 6_000,
};

export type EndOfSpeechState = {
  startedAtMs: number;
  speechHeard: boolean;
  lastSpeechAtMs: number | null;
  /** Whether any readable level has arrived — false means this device reports no metering. */
  meteringSeen: boolean;
};

export type EndOfSpeechDecision = {
  state: EndOfSpeechState;
  shouldStop: boolean;
  reason?: 'end_silence' | 'no_speech' | 'no_metering';
};

export function createEndOfSpeechState(startedAtMs: number): EndOfSpeechState {
  return { startedAtMs, speechHeard: false, lastSpeechAtMs: null, meteringSeen: false };
}

export function reduceEndOfSpeech(
  state: EndOfSpeechState,
  meteringDb: number | undefined,
  nowMs: number,
  config: EndOfSpeechConfig = DEFAULT_END_OF_SPEECH,
): EndOfSpeechDecision {
  const elapsed = nowMs - state.startedAtMs;
  const level = meteringDb != null && Number.isFinite(meteringDb) ? meteringDb : null;
  let next: EndOfSpeechState = state.meteringSeen || level == null ? state : { ...state, meteringSeen: true };

  if (level != null && level >= config.speechThresholdDb) {
    next = {
      ...next,
      speechHeard: true,
      lastSpeechAtMs: nowMs,
    };
    return { state: next, shouldStop: false };
  }

  if (!next.speechHeard) {
    // No level has ever arrived, so there is nothing to detect the end of speech with. Close the
    // take on a timer instead of holding the mic open to the hard cap; the audio still gets
    // transcribed, which is what matters.
    if (!next.meteringSeen && elapsed >= config.noMeteringStopMs) {
      return { state: next, shouldStop: true, reason: 'no_metering' };
    }
    // Do not auto-stop before speech is heard. Missing metering, constant low dB readings, and
    // slow talkers all used to trip no_speech → unduck → empty transcript (music dips then
    // returns with nothing logged). Hard MAX_RECORDING_MS / a second tap still end the take.
    if (
      Number.isFinite(config.noSpeechTimeoutMs) &&
      meteringDb != null &&
      Number.isFinite(meteringDb) &&
      elapsed >= config.noSpeechTimeoutMs
    ) {
      return { state: next, shouldStop: true, reason: 'no_speech' };
    }
    return { state: next, shouldStop: false };
  }

  if (elapsed < config.minRecordingMs) {
    return { state: next, shouldStop: false };
  }

  const lastSpeechAt = next.lastSpeechAtMs ?? next.startedAtMs;
  const silentFor = nowMs - lastSpeechAt;
  const isSilent =
    meteringDb == null || !Number.isFinite(meteringDb) || meteringDb <= config.silenceThresholdDb;

  if (isSilent && silentFor >= config.endSilenceMs) {
    return { state: next, shouldStop: true, reason: 'end_silence' };
  }

  return { state: next, shouldStop: false };
}

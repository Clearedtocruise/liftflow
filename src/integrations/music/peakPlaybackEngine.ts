import type { PeakMusicSettings, PeakPlaybackRequest, PlaybackSeekPlan } from '@/types/peakMusic';

/**
 * Compute when to start playback during rest so the saved peak aligns with rest end (next set).
 *
 * restStart + restDuration = nextSetStart
 * We want peakOffsetMs in song to occur at nextSetStart
 * => start song at restStart, seek to (peakOffsetMs - restDurationMs)
 */
export function computePeakPlaybackPlan(
  peakOffsetMs: number,
  restDurationMs: number,
): PlaybackSeekPlan {
  const seekToMs = Math.max(0, peakOffsetMs - restDurationMs);
  const startDelayMs = peakOffsetMs < restDurationMs ? restDurationMs - peakOffsetMs : 0;
  const peakHitsAtRestEnd = peakOffsetMs >= restDurationMs || startDelayMs + peakOffsetMs <= restDurationMs;

  return {
    seekToMs,
    startDelayMs,
    peakHitsAtRestEnd,
    restDurationMs,
    peakOffsetMs,
  };
}

export function shouldAutoSyncPeak(
  settings: PeakMusicSettings,
  context?: PeakPlaybackRequest['setContext'],
): boolean {
  if (!settings.enabled) return false;
  if (!settings.autoSyncHeavySetsOnly && !settings.autoSyncPrAttemptsOnly) return true;
  if (settings.autoSyncHeavySetsOnly && context?.isHeavySet) return true;
  if (settings.autoSyncPrAttemptsOnly && context?.isPrAttempt) return true;
  return false;
}

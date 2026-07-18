/**
 * Wall-clock elapsed seconds excluding paused time.
 * `elapsed = floor((anchorMs - startedAtMs - pausedAccumulatedMs) / 1000)`
 * where anchor is `pausedAtMs` while paused, otherwise `nowMs`.
 */
export function computeWorkoutElapsedSeconds(input: {
  startedAtMs: number;
  nowMs: number;
  status?: string;
  pausedAtMs?: number | null;
  pausedAccumulatedMs?: number;
}): number {
  const pausedAccumulatedMs = Math.max(0, input.pausedAccumulatedMs ?? 0);
  const anchorMs =
    input.status === 'paused' && input.pausedAtMs != null ? input.pausedAtMs : input.nowMs;
  return Math.max(0, Math.floor((anchorMs - input.startedAtMs - pausedAccumulatedMs) / 1000));
}

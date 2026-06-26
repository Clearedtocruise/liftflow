import type { CircuitTimerState, IntervalTimerState } from '@/lib/timerEngine';

export type WatchRestSource = 'traditional' | 'interval' | 'circuit';

export type WatchRestSnapshot = {
  seconds: number | null;
  source: WatchRestSource | null;
};

/** Pick the active rest countdown the Watch should mirror (circuit > interval > traditional). */
export function resolveWatchRestSnapshot(params: {
  traditionalSeconds: number | null;
  usesTraditionalRest: boolean;
  intervalTimer: IntervalTimerState | null;
  circuitTimer: CircuitTimerState | null;
}): WatchRestSnapshot {
  const { traditionalSeconds, usesTraditionalRest, intervalTimer, circuitTimer } = params;

  if (
    circuitTimer &&
    circuitTimer.phase !== 'done' &&
    circuitTimer.running &&
    circuitTimer.secondsRemaining > 0
  ) {
    return { seconds: circuitTimer.secondsRemaining, source: 'circuit' };
  }

  if (
    intervalTimer &&
    intervalTimer.phase === 'rest' &&
    intervalTimer.running &&
    intervalTimer.secondsRemaining > 0
  ) {
    return { seconds: intervalTimer.secondsRemaining, source: 'interval' };
  }

  if (usesTraditionalRest && traditionalSeconds != null && traditionalSeconds > 0) {
    return { seconds: traditionalSeconds, source: 'traditional' };
  }

  return { seconds: null, source: null };
}

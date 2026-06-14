export type TimedSetRecord = {
  durationSeconds: number;
  setNumber?: number;
};

export type TimedAdjustmentLabel = 'maintain' | 'increase_duration';

export type TimedProgressionRecommendation = {
  targetDurationSeconds: number;
  recommendedDurationSeconds: number;
  adjustmentLabel: TimedAdjustmentLabel;
  reason: string;
  detailedReason: string;
  confidence: number;
  basedOnSessions: number;
};

const TIMED_REP_RANGE_PATTERN = /\d+\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i;

export function isTimedRepRange(repRange?: string | null): boolean {
  return TIMED_REP_RANGE_PATTERN.test(repRange ?? '');
}

/** Lower bound of a rep range like "45-60 sec", or single value like "30 sec". */
export function parseTargetDurationSeconds(repRange?: string | null): number {
  const raw = repRange ?? '';
  const rangeMatch = raw.match(
    /(\d+)\s*-\s*(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i,
  );
  if (rangeMatch) {
    const low = Number.parseInt(rangeMatch[1], 10);
    if (Number.isFinite(low) && low > 0) {
      return /min/i.test(rangeMatch[3]) ? low * 60 : low;
    }
  }

  const singleMatch = raw.match(/(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i);
  if (singleMatch) {
    const value = Number.parseInt(singleMatch[1], 10);
    if (Number.isFinite(value) && value > 0) {
      return /min/i.test(singleMatch[2]) ? value * 60 : value;
    }
  }

  return 30;
}

export function formatDurationDelta(completedSeconds: number, targetSeconds: number): string {
  const delta = completedSeconds - targetSeconds;
  if (delta > 0) return `Exceeded target by ${delta} sec`;
  if (delta < 0) return `${Math.abs(delta)} sec below target`;
  return 'Hit target duration';
}

export function computeTimedProgression(input: {
  targetDurationSeconds: number;
  priorSessionSets: TimedSetRecord[][];
  currentSessionSets: TimedSetRecord[];
}): TimedProgressionRecommendation {
  const { targetDurationSeconds, priorSessionSets, currentSessionSets } = input;
  const lastCurrent = currentSessionSets[currentSessionSets.length - 1];

  let recommendedDurationSeconds = targetDurationSeconds;
  let adjustmentLabel: TimedAdjustmentLabel = 'maintain';
  let reason = `Hold ${targetDurationSeconds} sec per set.`;
  let detailedReason = 'Timed holds progress by duration, not load.';
  let confidence = priorSessionSets.length > 0 || currentSessionSets.length > 0 ? 0.85 : 0.6;

  if (lastCurrent && lastCurrent.durationSeconds > 0) {
    const completed = lastCurrent.durationSeconds;
    const delta = completed - targetDurationSeconds;

    if (delta >= 0) {
      adjustmentLabel = delta >= 15 ? 'increase_duration' : 'maintain';
      recommendedDurationSeconds =
        adjustmentLabel === 'increase_duration'
          ? Math.min(completed + 5, targetDurationSeconds + 30)
          : targetDurationSeconds;
      reason =
        delta > 0
          ? `Exceeded ${targetDurationSeconds}s target by ${delta}s — strong hold.`
          : `Hit ${targetDurationSeconds}s target — repeat this duration.`;
      detailedReason = formatDurationDelta(completed, targetDurationSeconds);
    } else {
      recommendedDurationSeconds = targetDurationSeconds;
      reason = `${Math.abs(delta)}s short of ${targetDurationSeconds}s — aim for the full hold.`;
      detailedReason = `Completed ${completed}s vs ${targetDurationSeconds}s target. Build time under tension before adding duration.`;
    }
  } else if (priorSessionSets.length > 0) {
    const lastSession = priorSessionSets[0]!;
    const best = lastSession.reduce(
      (max, set) => Math.max(max, set.durationSeconds),
      0,
    );
    if (best >= targetDurationSeconds + 15) {
      adjustmentLabel = 'increase_duration';
      recommendedDurationSeconds = Math.min(best + 5, targetDurationSeconds + 30);
      reason = `Last session best hold was ${best}s — progress duration slightly.`;
      detailedReason = `Prior sessions exceeded target; add ${recommendedDurationSeconds - targetDurationSeconds}s when ready.`;
    } else if (best >= targetDurationSeconds) {
      reason = `Last session hit ${targetDurationSeconds}s+ — maintain this hold.`;
      detailedReason = formatDurationDelta(best, targetDurationSeconds);
    } else if (best > 0) {
      reason = `Last session reached ${best}s — build toward ${targetDurationSeconds}s.`;
      detailedReason = `${targetDurationSeconds - best}s remaining to hit the programmed hold.`;
    }
  }

  return {
    targetDurationSeconds,
    recommendedDurationSeconds,
    adjustmentLabel,
    reason,
    detailedReason,
    confidence,
    basedOnSessions: priorSessionSets.length,
  };
}

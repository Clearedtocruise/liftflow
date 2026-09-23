/**
 * A lifter's past work on one exercise, gathered into the sessions it was done in.
 *
 * Sets are stored one row at a time, against whichever workout_exercise row held them that day.
 * "What have I been doing on bench?" is a question about days, not rows: every set from the same
 * session belongs together, and the same lift trained twice in one session is still that session.
 */

export type ExerciseHistorySetRow = {
  workoutExerciseId: string;
  setNumber: number;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  isPr?: boolean;
  loggedAt: string;
};

export type ExerciseSessionRow = {
  workoutExerciseId: string;
  sessionId: string;
  sessionName: string;
  /** When the session started, which is the date a lifter remembers the workout by. */
  performedAt: string;
};

export type ExerciseSessionSet = Omit<ExerciseHistorySetRow, 'workoutExerciseId'>;

export type ExerciseHistorySession = {
  sessionId: string;
  sessionName: string;
  performedAt: string;
  sets: ExerciseSessionSet[];
  /** Sum of weight × reps. Zero for work carrying no load, which is not the same as no work. */
  volumeKg: number;
  topSet: ExerciseSessionSet | null;
  hasPr: boolean;
};

export type ExerciseHistorySummary = {
  sessionCount: number;
  setCount: number;
  lastPerformedAt: string | null;
  /** Heaviest set ever logged, or the longest hold when the lift carries no load. */
  bestSet: ExerciseSessionSet | null;
  bestVolumeKg: number;
};

/**
 * The set that represents a day's work on the lift.
 *
 * Heaviest wins, and reps break a tie, so 100kg×8 reads as the day's top set over 100kg×5. With no
 * load to compare — bodyweight rows, timed holds — the most reps or the longest hold stands in,
 * otherwise a plank session would report nothing at all.
 */
export function pickTopSet(sets: ExerciseSessionSet[]): ExerciseSessionSet | null {
  return sets.reduce<ExerciseSessionSet | null>((best, set) => {
    if (!best) return set;
    const bestWeight = best.weightKg ?? 0;
    const weight = set.weightKg ?? 0;
    if (weight !== bestWeight) return weight > bestWeight ? set : best;
    const bestReps = best.reps ?? 0;
    const reps = set.reps ?? 0;
    if (reps !== bestReps) return reps > bestReps ? set : best;
    return (set.durationSeconds ?? 0) > (best.durationSeconds ?? 0) ? set : best;
  }, null);
}

export function setVolumeKg(set: ExerciseSessionSet): number {
  if (!set.weightKg || !set.reps) return 0;
  return set.weightKg * set.reps;
}

/**
 * Group logged sets into sessions, newest session first, sets in the order they were performed.
 *
 * `sessions` maps each workout_exercise row to the day it belongs to. A set whose row is missing
 * from that map has no day to belong to and is dropped rather than shown under a blank heading.
 */
export function buildExerciseHistory(
  sets: ExerciseHistorySetRow[],
  sessions: ExerciseSessionRow[],
  options?: { limit?: number },
): ExerciseHistorySession[] {
  const sessionByExerciseRow = new Map(sessions.map((row) => [row.workoutExerciseId, row]));
  const grouped = new Map<string, ExerciseHistorySession>();

  for (const set of sets) {
    const session = sessionByExerciseRow.get(set.workoutExerciseId);
    if (!session) continue;

    const entry = grouped.get(session.sessionId) ?? {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      performedAt: session.performedAt,
      sets: [],
      volumeKg: 0,
      topSet: null,
      hasPr: false,
    };

    const { workoutExerciseId: _row, ...rest } = set;
    entry.sets.push(rest);
    grouped.set(session.sessionId, entry);
  }

  const ordered = [...grouped.values()]
    .map((session) => {
      const sets = [...session.sets].sort((a, b) => {
        const byTime = Date.parse(a.loggedAt) - Date.parse(b.loggedAt);
        return byTime !== 0 ? byTime : a.setNumber - b.setNumber;
      });
      return {
        ...session,
        sets,
        volumeKg: sets.reduce((total, set) => total + setVolumeKg(set), 0),
        topSet: pickTopSet(sets),
        hasPr: sets.some((set) => set.isPr === true),
      };
    })
    .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));

  return options?.limit != null ? ordered.slice(0, options.limit) : ordered;
}

export function summarizeExerciseHistory(
  sessions: ExerciseHistorySession[],
): ExerciseHistorySummary {
  const allSets = sessions.flatMap((session) => session.sets);
  return {
    sessionCount: sessions.length,
    setCount: allSets.length,
    lastPerformedAt: sessions[0]?.performedAt ?? null,
    bestSet: pickTopSet(allSets),
    bestVolumeKg: sessions.reduce((best, session) => Math.max(best, session.volumeKg), 0),
  };
}

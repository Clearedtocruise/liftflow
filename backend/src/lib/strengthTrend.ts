export type LoggedSet = {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
};

export type StrengthTrendEntry = {
  exercise: string;
  /** Distinct training days the exercise appears on, not set count. */
  sessions: number;
  firstDate: string;
  lastDate: string;
  daysCovered: number;
  firstTopSet: { weight: number; reps: number };
  lastTopSet: { weight: number; reps: number };
  /** Epley estimate, so an extra rep at the same load still reads as progress. */
  firstEstimated1rm: number;
  lastEstimated1rm: number;
  deltaEstimated1rm: number;
  direction: 'up' | 'down' | 'flat';
};

export type StrengthTrendSummary = {
  entries: StrengthTrendEntry[];
  /** Exercises trained repeatedly over 2+ weeks without an estimated-1RM gain. */
  stalledExercises: string[];
};

/**
 * A 2% band around the previous estimate. Day-to-day load selection and rep miscounts move the
 * estimate by a kilo or two, and calling that "progress" would let the coach congratulate a user
 * who has actually been flat for a month.
 */
const MEANINGFUL_CHANGE_RATIO = 0.02;

const STALL_MIN_SESSIONS = 3;
const STALL_MIN_DAYS = 14;

function estimate1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function dayOf(date: string): string {
  return date.slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 0;
  return Math.round(ms / 86_400_000);
}

/** The heaviest set of a day, breaking ties on reps so 100x8 outranks 100x5. */
function topSetOf(sets: LoggedSet[]): LoggedSet {
  return sets.reduce((best, set) => {
    if (set.weight !== best.weight) return set.weight > best.weight ? set : best;
    return set.reps > best.reps ? set : best;
  });
}

function directionOf(first: number, last: number): 'up' | 'down' | 'flat' {
  const band = Math.max(first * MEANINGFUL_CHANGE_RATIO, 0.5);
  if (last - first > band) return 'up';
  if (first - last > band) return 'down';
  return 'flat';
}

/**
 * Turns a flat list of logged sets into a per-exercise first-vs-latest comparison so the coach can
 * see direction over weeks instead of a single most-recent set. Pure: the caller supplies whatever
 * window it already queried.
 */
export function summarizeStrengthTrend(sets: LoggedSet[], maxExercises = 5): StrengthTrendSummary {
  const byExercise = new Map<string, Map<string, LoggedSet[]>>();

  for (const set of sets) {
    if (!set.exercise || set.weight <= 0 || set.reps <= 0 || !set.date) continue;
    const days = byExercise.get(set.exercise) ?? new Map<string, LoggedSet[]>();
    const day = dayOf(set.date);
    days.set(day, [...(days.get(day) ?? []), set]);
    byExercise.set(set.exercise, days);
  }

  const entries: StrengthTrendEntry[] = [];

  for (const [exercise, days] of byExercise) {
    // A single day gives no direction, only a data point the caller already has.
    if (days.size < 2) continue;

    const orderedDays = [...days.keys()].sort();
    const firstDate = orderedDays[0];
    const lastDate = orderedDays[orderedDays.length - 1];
    const firstTop = topSetOf(days.get(firstDate)!);
    const lastTop = topSetOf(days.get(lastDate)!);

    const firstEstimated1rm = estimate1rm(firstTop.weight, firstTop.reps);
    const lastEstimated1rm = estimate1rm(lastTop.weight, lastTop.reps);

    entries.push({
      exercise,
      sessions: days.size,
      firstDate,
      lastDate,
      daysCovered: daysBetween(firstDate, lastDate),
      firstTopSet: { weight: firstTop.weight, reps: firstTop.reps },
      lastTopSet: { weight: lastTop.weight, reps: lastTop.reps },
      firstEstimated1rm,
      lastEstimated1rm,
      deltaEstimated1rm: Math.round((lastEstimated1rm - firstEstimated1rm) * 10) / 10,
      direction: directionOf(firstEstimated1rm, lastEstimated1rm),
    });
  }

  entries.sort((a, b) => b.sessions - a.sessions || b.daysCovered - a.daysCovered);
  const top = entries.slice(0, maxExercises);

  return {
    entries: top,
    stalledExercises: top
      .filter(
        (entry) =>
          entry.direction !== 'up' &&
          entry.sessions >= STALL_MIN_SESSIONS &&
          entry.daysCovered >= STALL_MIN_DAYS,
      )
      .map((entry) => entry.exercise),
  };
}

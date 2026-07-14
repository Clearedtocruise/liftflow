import type { ExerciseHistorySet } from '@/types/workoutExecution';

export type ExerciseProgressPoint = {
  /** Local calendar day YYYY-MM-DD */
  date: string;
  bestWeightKg: number;
  bestReps: number;
  /** Epley estimate when reps are in 1–12; null otherwise */
  estimated1RmKg: number | null;
  volumeKg: number;
  setCount: number;
};

export type ExerciseProgressMetric = 'estimated_1rm' | 'best_weight' | 'volume' | 'best_reps';

export type TrackedLiftExercise = {
  exerciseId: string;
  name: string;
  lastLoggedAt: string;
  setCount: number;
  lastWeightKg?: number;
  lastReps?: number;
};

/** Epley: weight × (1 + reps/30). Unreliable above 12 reps — return null. */
export function estimateOneRepMaxKg(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps < 1) return null;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  if (reps > 12) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function localDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Collapse raw sets into one point per training day (chronological).
 * Safe with empty / malformed input.
 */
export function buildExerciseProgressSeries(
  sets: Array<Pick<ExerciseHistorySet, 'weightKg' | 'reps' | 'loggedAt'>>,
): ExerciseProgressPoint[] {
  if (!Array.isArray(sets) || sets.length === 0) return [];

  const byDay = new Map<string, ExerciseProgressPoint>();

  for (const set of sets) {
    if (!set?.loggedAt) continue;
    const day = localDayKey(set.loggedAt);
    const weight = set.weightKg != null && set.weightKg > 0 ? set.weightKg : 0;
    const reps = set.reps != null && set.reps > 0 ? set.reps : 0;
    const e1rm = weight > 0 && reps > 0 ? estimateOneRepMaxKg(weight, reps) : null;
    const volume = weight > 0 && reps > 0 ? weight * reps : 0;

    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, {
        date: day,
        bestWeightKg: weight,
        bestReps: reps,
        estimated1RmKg: e1rm,
        volumeKg: volume,
        setCount: weight > 0 || reps > 0 ? 1 : 0,
      });
      continue;
    }

    existing.setCount += weight > 0 || reps > 0 ? 1 : 0;
    existing.volumeKg += volume;

    if (e1rm != null && (existing.estimated1RmKg == null || e1rm > existing.estimated1RmKg)) {
      existing.estimated1RmKg = e1rm;
      existing.bestWeightKg = weight;
      existing.bestReps = reps;
    } else if (existing.estimated1RmKg == null) {
      if (weight > existing.bestWeightKg) {
        existing.bestWeightKg = weight;
        existing.bestReps = reps > 0 ? reps : existing.bestReps;
      } else if (weight === 0 && reps > existing.bestReps) {
        existing.bestReps = reps;
      }
    }
  }

  return [...byDay.values()]
    .filter((point) => point.setCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function defaultMetricForSeries(points: ExerciseProgressPoint[]): ExerciseProgressMetric {
  if (points.some((p) => p.estimated1RmKg != null && p.estimated1RmKg > 0)) return 'estimated_1rm';
  if (points.some((p) => p.bestWeightKg > 0)) return 'best_weight';
  return 'best_reps';
}

export function metricValue(point: ExerciseProgressPoint, metric: ExerciseProgressMetric): number {
  switch (metric) {
    case 'estimated_1rm':
      return point.estimated1RmKg ?? 0;
    case 'best_weight':
      return point.bestWeightKg;
    case 'volume':
      return point.volumeKg;
    case 'best_reps':
      return point.bestReps;
    default:
      return 0;
  }
}

export function metricLabel(metric: ExerciseProgressMetric, weightLabel: string): string {
  switch (metric) {
    case 'estimated_1rm':
      return `Est. 1RM (${weightLabel})`;
    case 'best_weight':
      return `Best set (${weightLabel})`;
    case 'volume':
      return `Volume (${weightLabel})`;
    case 'best_reps':
      return 'Best reps';
    default:
      return 'Progress';
  }
}

/** Keep charts readable — last N training days. */
export function sliceRecentPoints(points: ExerciseProgressPoint[], limit = 12): ExerciseProgressPoint[] {
  if (points.length <= limit) return points;
  return points.slice(-limit);
}

export function summarizeProgressDelta(
  points: ExerciseProgressPoint[],
  metric: ExerciseProgressMetric,
): { latest: number; delta: number | null; pct: number | null } | null {
  const usable = points.filter((p) => metricValue(p, metric) > 0);
  if (usable.length === 0) return null;
  const latest = metricValue(usable[usable.length - 1]!, metric);
  if (usable.length < 2) return { latest, delta: null, pct: null };
  const first = metricValue(usable[0]!, metric);
  const delta = Math.round((latest - first) * 10) / 10;
  const pct = first > 0 ? Math.round(((latest - first) / first) * 100) : null;
  return { latest, delta, pct };
}

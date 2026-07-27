/**
 * Filling a home metric from a manually recorded value when the automatic source has nothing.
 *
 * Sleep is the case that motivated this: Apple Health supplies it for anyone with a wearable, and
 * the recovery check-in supplies it for everyone else. Reading only Health left a hand-entered
 * figure invisible on the home screen even though the same number was already driving the
 * recovery score.
 */

export type MetricSeries = {
  value?: number;
  /** Oldest to newest, one entry per day, with gaps preserved. */
  history: (number | undefined)[];
};

/**
 * Measured data for *today* always wins where it exists — a wearable recorded the night, a person
 * estimated it. Older days in the series must not block today's check-in: previously any value
 * anywhere in the week (usually yesterday's Health sleep) made the fallback a no-op, so a hand-
 * entered night never appeared on home.
 */
export function withTodayFallback(metric: MetricSeries, todayValue?: number): MetricSeries {
  if (todayValue == null || !Number.isFinite(todayValue)) return metric;

  const history = [...metric.history];
  const todayIndex = history.length - 1;
  if (todayIndex >= 0 && history[todayIndex] != null) return metric;

  if (todayIndex >= 0) history[todayIndex] = todayValue;
  return { value: todayValue, history };
}

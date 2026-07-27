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
 * Measured data always wins where it exists — a wearable recorded the night, a person estimated it.
 * The fallback only fills a gap, and only for the most recent day.
 */
export function withTodayFallback(metric: MetricSeries, todayValue?: number): MetricSeries {
  if (todayValue == null || !Number.isFinite(todayValue)) return metric;
  if (metric.value != null) return metric;

  const history = [...metric.history];
  if (history.length > 0) history[history.length - 1] = todayValue;
  return { value: todayValue, history };
}

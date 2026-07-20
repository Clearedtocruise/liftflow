/** Daily energy balance for fat-loss goals: burned (Apple) − consumed (meals). */
export function computeDailyDeficit(burned: number, consumed: number): number {
  return Math.max(0, Math.round(burned) - Math.round(consumed));
}

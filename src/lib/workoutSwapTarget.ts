/**
 * Which workout exercise a Swap tap should replace.
 *
 * A finished lift already has its sets. Replacing that row in place is refused (the logged
 * work has to stay), so Swap looked like it did nothing. Point it at the next exercise that
 * has not been logged yet — that one can actually change.
 */
export function resolveSwapTargetIndex(currentIndex: number, loggedCounts: number[]): number {
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, loggedCounts.length - 1));
  if ((loggedCounts[safeIndex] ?? 0) === 0) return safeIndex;

  for (let index = safeIndex + 1; index < loggedCounts.length; index += 1) {
    if ((loggedCounts[index] ?? 0) === 0) return index;
  }

  return safeIndex;
}

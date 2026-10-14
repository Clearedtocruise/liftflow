/**
 * Which workout exercise a Swap tap should replace.
 *
 * Swap means the lift on screen, and logged sets do not change that: a shoulder that complains on
 * set two of overhead press is the most common reason to swap at all. The sets already in stay
 * with the original lift and the replacement slots in behind them, so there is nothing to protect
 * by sending the tap somewhere else.
 *
 * The one case that does move is a lift with nothing left to do. Replacing it would quietly add
 * work rather than change any, so the tap carries forward to the next lift not yet started.
 */

export type SwapCandidate = {
  loggedSets: number;
  targetSets: number;
};

export function resolveSwapTargetIndex(currentIndex: number, candidates: SwapCandidate[]): number {
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, candidates.length - 1));
  const current = candidates[safeIndex];
  if (!current || !isFinished(current)) return safeIndex;

  for (let index = safeIndex + 1; index < candidates.length; index += 1) {
    if ((candidates[index]?.loggedSets ?? 0) === 0) return index;
  }

  return safeIndex;
}

function isFinished(candidate: SwapCandidate): boolean {
  return candidate.targetSets > 0 && candidate.loggedSets >= candidate.targetSets;
}

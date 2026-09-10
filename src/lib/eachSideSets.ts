/**
 * Plans often prescribe unilateral holds as "3 × 30 sec each side". Logging left then right
 * as two sets used to burn two of the three planned slots, so the second full round never
 * existed — it felt like the workout skipped through set 2 of side planks.
 */

const EACH_SIDE_PATTERN =
  /(?:each\s+side|per\s+side|\/\s*side|left\s*(?:&|and|\/)\s*right|both\s+sides)/i;

export function looksLikeEachSide(...hints: Array<string | null | undefined>): boolean {
  return hints.some((hint) => Boolean(hint && EACH_SIDE_PATTERN.test(hint)));
}

/** Turn "3 sets each side" into 6 loggable holds (Left, Right, Left, Right, …). */
export function expandSetsForEachSide(
  sets: number,
  ...hints: Array<string | null | undefined>
): number {
  const safe = Number.isFinite(sets) && sets > 0 ? Math.floor(sets) : 0;
  if (safe <= 0) return safe;
  return looksLikeEachSide(...hints) ? safe * 2 : safe;
}

export function eachSideLabelForSet(
  setNumber: number,
  ...hints: Array<string | null | undefined>
): 'Left' | 'Right' | null {
  if (!looksLikeEachSide(...hints) || setNumber < 1) return null;
  return setNumber % 2 === 1 ? 'Left' : 'Right';
}

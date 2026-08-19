/**
 * Catalog lookup has to treat "Pull-Up", "Pull Up" and slug `pull-up` as the same lift.
 * Exact-name matching dropped hyphenated plan names when the catalog used spaces, then
 * creating a custom row failed on the unique slug — so the session started on the next
 * exercise with no sets logged.
 */

export function exerciseNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function exerciseSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function namesMatchExercise(a: string, b: string): boolean {
  const left = exerciseNameKey(a);
  const right = exerciseNameKey(b);
  return left.length > 0 && left === right;
}

/** Names to try against `exercises.name` before falling back to slug. */
export function exerciseNameLookupCandidates(name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];
  const spaced = trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const unique = [trimmed];
  if (spaced && spaced.toLowerCase() !== trimmed.toLowerCase()) unique.push(spaced);
  return unique;
}

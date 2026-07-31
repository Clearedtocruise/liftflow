/**
 * Naming rules for exercises a lifter adds themselves.
 *
 * The catalog is large but never complete — gym-specific machines, coach variations and
 * competition lifts all show up missing. The picker previously dead-ended at "No exercises found",
 * so an exercise outside the database could not be added or swapped in at all.
 */

export const MAX_CUSTOM_EXERCISE_NAME = 60;
const MIN_CUSTOM_EXERCISE_NAME = 2;

/** Collapses whitespace so "  Hack   Squat " and "Hack Squat" cannot become two rows. */
export function normalizeCustomExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_EXERCISE_NAME);
}

/** Case- and spacing-insensitive identity, matching the service's `ilike` lookup. */
export function isSameExerciseName(a: string, b: string): boolean {
  return normalizeCustomExerciseName(a).toLowerCase() === normalizeCustomExerciseName(b).toLowerCase();
}

export type CustomExerciseNameCheck =
  | { valid: true; name: string }
  | { valid: false; reason: string };

export function validateCustomExerciseName(raw: string): CustomExerciseNameCheck {
  const name = normalizeCustomExerciseName(raw);

  if (name.length < MIN_CUSTOM_EXERCISE_NAME) {
    return { valid: false, reason: 'Give the exercise a name first.' };
  }
  // A name with no letters is almost always a stray weight or rep count typed into the search box.
  if (!/[a-z]/i.test(name)) {
    return { valid: false, reason: 'Exercise names need letters, not just numbers.' };
  }

  return { valid: true, name };
}

/**
 * Whether to offer "Create <name>". Hidden when the search already contains that exact exercise,
 * so the catalog entry stays the obvious choice and duplicates are not invited.
 */
export function shouldOfferCustomExercise(
  query: string,
  results: Array<{ name: string }>,
): boolean {
  const check = validateCustomExerciseName(query);
  if (!check.valid) return false;
  return !results.some((result) => isSameExerciseName(result.name, check.name));
}

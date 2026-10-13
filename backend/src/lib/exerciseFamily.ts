import { exerciseNamePattern, namesMatchExercise } from './exerciseNameLookup.js';
import { requireAdmin } from './supabase.js';

/** The pattern is loose by design, so cap the rows pulled back before the exact-name filter. */
const FAMILY_SCAN_LIMIT = 100;

/**
 * Every catalog row that is the same lift as `exerciseId` under a different spelling.
 *
 * `exercises.name` has no unique constraint, so "Decline Push-Ups" and "Decline Push Up" can be
 * two rows with two separate histories. Reads that want "what did I lift last time" have to span
 * the whole family or they silently miss the sets logged under the other spelling.
 */
export async function loadExerciseFamilyIds(exerciseId: string, exerciseName?: string): Promise<string[]> {
  const name = exerciseName?.trim() ?? '';
  const pattern = name ? exerciseNamePattern(name) : '';
  if (!pattern) return [exerciseId];

  const db = requireAdmin();
  const { data, error } = await db
    .from('exercises')
    .select('id, name')
    .ilike('name', pattern)
    .limit(FAMILY_SCAN_LIMIT);

  // A failed widening must not cost the exercise its own history.
  if (error) return [exerciseId];

  const ids = new Set<string>([exerciseId]);
  for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
    if (namesMatchExercise(row.name ?? '', name)) ids.add(row.id);
  }
  return [...ids];
}

/** Same, for callers holding an exercise id but no catalog name. */
export async function loadExerciseFamilyIdsForId(exerciseId: string): Promise<string[]> {
  const db = requireAdmin();
  const { data } = await db.from('exercises').select('name').eq('id', exerciseId).maybeSingle();
  return loadExerciseFamilyIds(exerciseId, data?.name ?? undefined);
}

import { exerciseNamePatterns, namesMatchExercise } from '@/lib/exerciseNameLookup';
import { supabase } from '@/supabase/client';

/** The pattern is loose by design, so cap the rows pulled back before the exact-name filter. */
const FAMILY_SCAN_LIMIT = 100;

/** Superset rotation returns to the same lift repeatedly; the catalog does not move underneath. */
const familyCache = new Map<string, string[]>();

/**
 * Every catalog row that is the same lift as `exerciseId` under a different spelling.
 *
 * `exercises.name` has no unique constraint, so "Decline Push-Ups", "Decline Pushups" and
 * "Decline Push Up" can all exist as separate rows. History hangs off `exercise_id`, so each row
 * remembers its own weight and none of them remembers the others' — which is the app appearing to
 * forget what you lifted last time. Reads have to span the whole family.
 */
export async function exerciseFamilyIds(exerciseId: string, exerciseName?: string): Promise<string[]> {
  const name = exerciseName?.trim() ?? '';
  const patterns = name ? exerciseNamePatterns(name) : [];
  if (patterns.length === 0) return [exerciseId];

  const cacheKey = `${exerciseId}|${patterns.join('|')}`;
  const cached = familyCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('exercises')
    .select('id, name')
    .or(patterns.map((pattern) => `name.ilike.${pattern}`).join(','))
    .limit(FAMILY_SCAN_LIMIT);

  // A failed widening must not cost the exercise its own history, so fall back to the single row
  // rather than surfacing an error — and do not cache a result the catalog never confirmed.
  if (error) return [exerciseId];

  const ids = new Set<string>([exerciseId]);
  for (const row of data ?? []) {
    if (namesMatchExercise(row.name ?? '', name)) ids.add(row.id);
  }
  const resolved = [...ids];
  familyCache.set(cacheKey, resolved);
  return resolved;
}

/** Same, for callers holding an exercise id but no catalog name. */
export async function exerciseFamilyIdsForId(exerciseId: string): Promise<string[]> {
  const { data } = await supabase.from('exercises').select('name').eq('id', exerciseId).maybeSingle();
  return exerciseFamilyIds(exerciseId, data?.name ?? undefined);
}

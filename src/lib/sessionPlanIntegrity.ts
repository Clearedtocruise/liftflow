import { namesMatchExercise } from '@/lib/exerciseNameLookup';

/**
 * Planned names that have no matching row in the live session.
 *
 * When the DB seed trigger drops an unresolved name (or collapses a duplicate onto one
 * `exercise_id`), the session list is shorter than the plan — finishing Romanian Deadlift then
 * advances straight onto Calf Raise because Walking Lunge was never inserted. Callers use this
 * to decide whether to re-apply the plan before the lifter is left staring at a hole.
 */
export function missingPlanExerciseNames(
  planNames: readonly string[],
  sessionNames: readonly string[],
): string[] {
  const remaining = sessionNames.map((name) => ({ name, used: false }));

  const missing: string[] = [];
  for (const planned of planNames) {
    const trimmed = planned.trim();
    if (!trimmed) continue;
    const matchIndex = remaining.findIndex(
      (candidate) => !candidate.used && namesMatchExercise(candidate.name, trimmed),
    );
    if (matchIndex < 0) {
      missing.push(trimmed);
      continue;
    }
    remaining[matchIndex]!.used = true;
  }
  return missing;
}

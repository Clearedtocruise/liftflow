/**
 * Sets this screen has already written, remembered by workout_exercise id.
 *
 * Logging a set refreshes the session, but the refreshed set list only reaches the logger on the
 * next render. A second log that arrives before that render — a wrist tap, a spoken set, or a
 * fast second press — runs in a closure still holding the old list. The exercise then counts one
 * set too few: it announces the same set number twice, and it accepts a set past the plan target
 * because the ceiling check is measured against the stale count.
 *
 * The ledger closes that window. It carries ids rather than a tally so that a set arriving from
 * both sources, or a refresh landing in between, cannot be counted twice.
 */
export type LoggedSetLedger = Record<string, string[]>;

/** How many sets that exercise has, counting anything written but not yet refreshed in. */
export function countLoggedSets(
  sessionSets: { id: string }[] | null | undefined,
  ledger: LoggedSetLedger,
  workoutExerciseId: string | null | undefined,
): number {
  const ids = new Set((sessionSets ?? []).map((set) => set.id));
  if (workoutExerciseId) {
    for (const id of ledger[workoutExerciseId] ?? []) ids.add(id);
  }
  return ids.size;
}

export function recordLoggedSet(
  ledger: LoggedSetLedger,
  workoutExerciseId: string | null | undefined,
  setId: string | null | undefined,
): LoggedSetLedger {
  if (!workoutExerciseId || !setId) return ledger;
  const existing = ledger[workoutExerciseId] ?? [];
  if (existing.includes(setId)) return ledger;
  return { ...ledger, [workoutExerciseId]: [...existing, setId] };
}

/** A deleted set must leave the ledger, or the exercise stays full at a set that no longer exists. */
export function forgetLoggedSet(ledger: LoggedSetLedger, setId: string | null | undefined): LoggedSetLedger {
  if (!setId) return ledger;
  let changed = false;
  const next: LoggedSetLedger = {};
  for (const [workoutExerciseId, ids] of Object.entries(ledger)) {
    const kept = ids.filter((id) => id !== setId);
    if (kept.length !== ids.length) changed = true;
    next[workoutExerciseId] = kept;
  }
  return changed ? next : ledger;
}

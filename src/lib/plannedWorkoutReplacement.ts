/**
 * Where a planned workout went after the plan rewrote it.
 *
 * A custom cycle re-lays its days when one is missed: the day waits, so everything after it moves
 * back a date and the rows it rewrote are cancelled and inserted again under new ids. A screen
 * opened before that still holds the old id, and adding an exercise to it hit a row that no longer
 * existed ("Workout not found"). The workout the lifter was looking at still exists — Legs is
 * still Day 3, just on another date — so edits follow it there.
 */

export type ReplaceablePlannedRow = {
  id: string;
  status: string;
  scheduled_date: string;
  name?: string | null;
  created_at?: string | null;
  metadata?: { planPack?: string; programId?: string; cycleDay?: number } | null;
};

const CUSTOM_CYCLE_PLAN_PACK = 'custom_cycle';

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

function newestFirst<T extends ReplaceablePlannedRow>(a: T, b: T): number {
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

/**
 * The row now standing in for `original`, from `candidates`.
 *
 * A cycle day is followed to the nearest date that still carries the same day of the same program.
 * Anything else, or a cycle day the plan no longer has, is replaced by whatever is now planned on
 * its own date. Returns null when nothing stands in for it.
 *
 * `sameWorkoutOnly` is for writes: an edit carries the old workout's whole exercise list, and
 * landing that on a different workout that merely took the date would overwrite it.
 */
export function pickReplacementPlannedRow<T extends ReplaceablePlannedRow>(
  original: ReplaceablePlannedRow,
  candidates: T[],
  options?: { sameWorkoutOnly?: boolean },
): T | null {
  const open = candidates.filter((row) => row.id !== original.id && row.status === 'planned');
  const meta = original.metadata ?? {};

  if (meta.planPack === CUSTOM_CYCLE_PLAN_PACK && typeof meta.cycleDay === 'number') {
    const sameDay = open
      .filter(
        (row) =>
          row.metadata?.planPack === CUSTOM_CYCLE_PLAN_PACK &&
          row.metadata?.cycleDay === meta.cycleDay &&
          (!meta.programId || row.metadata?.programId === meta.programId),
      )
      .sort(
        (a, b) =>
          daysApart(a.scheduled_date, original.scheduled_date) -
            daysApart(b.scheduled_date, original.scheduled_date) ||
          a.scheduled_date.localeCompare(b.scheduled_date) ||
          newestFirst(a, b),
      );
    if (sameDay[0]) return sameDay[0];
    if (options?.sameWorkoutOnly) return null;
  }

  const sameDate = open
    .filter(
      (row) =>
        row.scheduled_date === original.scheduled_date &&
        (!options?.sameWorkoutOnly || (original.name != null && row.name === original.name)),
    )
    .sort(newestFirst);
  return sameDate[0] ?? null;
}

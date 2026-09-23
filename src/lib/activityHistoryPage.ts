/**
 * Reading back a training history that is longer than one page, out of two separate records.
 *
 * Lifts and cardio live in different tables and are only one history once they are merged by date.
 * Paging each table independently and appending the results would interleave them wrongly: the
 * second page of lifts can be older than cardio that has not been fetched yet, so a session would
 * land below entries it happened after. Every page therefore stops at the point where the two
 * records are both still complete, and the next page starts from there.
 */

import type { WorkoutHistoryItem } from '@/types/workout';

export type ActivityHistoryPage = {
  items: WorkoutHistoryItem[];
  /**
   * Where the next page starts: the oldest moment this page can vouch for. Inclusive, because two
   * sessions can share a timestamp — the caller drops what it has already seen by id.
   */
  nextBefore: string | null;
  hasMore: boolean;
};

const byNewestFirst = (a: WorkoutHistoryItem, b: WorkoutHistoryItem) =>
  Date.parse(b.date) - Date.parse(a.date);

/**
 * Cut a merged page at the point both records still cover.
 *
 * A record that returned everything it has left imposes no limit. A record with more to give can
 * only be trusted back as far as its own oldest row, so when both have more, the newer of those
 * two moments is the furthest back this page may go.
 */
export function mergeActivityHistoryPage(input: {
  strength: WorkoutHistoryItem[];
  cardio: WorkoutHistoryItem[];
  strengthHasMore: boolean;
  cardioHasMore: boolean;
}): ActivityHistoryPage {
  const merged = [...input.strength, ...input.cardio].sort(byNewestFirst);

  const oldestOf = (items: WorkoutHistoryItem[], hasMore: boolean): number | null => {
    if (!hasMore || items.length === 0) return null;
    return Date.parse(items[items.length - 1].date);
  };

  const strengthFloor = oldestOf(input.strength, input.strengthHasMore);
  const cardioFloor = oldestOf(input.cardio, input.cardioHasMore);

  const floors = [strengthFloor, cardioFloor].filter((value): value is number => value != null);
  if (floors.length === 0) {
    return { items: merged, nextBefore: null, hasMore: false };
  }

  const cutoff = Math.max(...floors);
  return {
    items: merged.filter((item) => Date.parse(item.date) >= cutoff),
    nextBefore: new Date(cutoff).toISOString(),
    hasMore: true,
  };
}

/**
 * Add a page to what is already on screen.
 *
 * Pages overlap by design — the cursor is inclusive so a session sharing a timestamp with the
 * cutoff is not lost between pages — so the same session can arrive twice and is kept once.
 */
export function appendActivityHistory(
  existing: WorkoutHistoryItem[],
  incoming: WorkoutHistoryItem[],
): WorkoutHistoryItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const added = incoming.filter((item) => !seen.has(item.id));
  return [...existing, ...added].sort(byNewestFirst);
}

export type HistoryMonth = {
  /** Sortable key, e.g. "2026-09". */
  key: string;
  label: string;
  items: WorkoutHistoryItem[];
};

/**
 * Break a long history into the months it was trained in, so a year of work can be read.
 * The current year is left off the heading — "September" reads as this September.
 */
export function groupHistoryByMonth(
  items: WorkoutHistoryItem[],
  now = new Date(),
): HistoryMonth[] {
  const months = new Map<string, HistoryMonth>();

  for (const item of [...items].sort(byNewestFirst)) {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = months.get(key) ?? {
      key,
      label: date.toLocaleDateString(undefined, {
        month: 'long',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
      }),
      items: [],
    };
    month.items.push(item);
    months.set(key, month);
  }

  return [...months.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

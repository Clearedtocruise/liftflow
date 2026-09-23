import { mergeActivityHistoryPage } from '@/lib/activityHistoryPage';
import { dedupeOverlappingCardio } from '@/lib/cardioHistoryDedupe';
import { cardioService } from '@/services/cardioService';
import { workoutService } from '@/services/workoutService';
import type { ServiceResult } from '@/types/common';
import type { WorkoutHistoryItem } from '@/types/workout';

function cardioTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    walk: 'Walk',
    run: 'Run',
    cycle: 'Bike',
    row: 'Row',
    treadmill: 'Treadmill',
    elliptical: 'Elliptical',
    swim: 'Swim',
    other: 'Cardio',
    hiit: 'HIIT',
  };
  return labels[type] ?? 'Cardio';
}

export type ActivityHistoryPageResult = {
  data: WorkoutHistoryItem[];
  /** Where the next page starts. Null when the history has been read to its end. */
  nextBefore: string | null;
  hasMore: boolean;
  /**
   * Everything on record up to the cursor, which is not the same as everything read so far. On the
   * first page that is the whole history, so that is the page worth quoting a total from.
   */
  totals: { strength: number; cardio: number; all: number };
};

/**
 * One page of a training history, lifts and cardio merged by date.
 *
 * Reading further back is a `before` cursor rather than a page number: the two records are paged
 * independently and only become one history once merged, so each page is cut where both records
 * are still complete. See {@link mergeActivityHistoryPage}.
 */
export async function getCombinedActivityHistory(
  userId: string,
  options?: { before?: string | null; pageSize?: number },
): Promise<ServiceResult<ActivityHistoryPageResult>> {
  const pageSize = options?.pageSize ?? 20;
  const before = options?.before ?? null;

  const [workoutResult, cardioResult] = await Promise.all([
    workoutService.getHistory(userId, 1, { before, pageSize }),
    cardioService.getRecent(userId, pageSize, { before }),
  ]);

  const strengthItems: WorkoutHistoryItem[] = workoutResult.success
    ? workoutResult.data.data.map((item) => ({ ...item, sessionKind: 'strength' as const }))
    : [];

  const cardioItems: WorkoutHistoryItem[] = cardioResult.success
    ? dedupeOverlappingCardio(
        cardioResult.data.map((session) => {
          const durationMinutes = Math.max(1, Math.round((session.durationSeconds ?? 0) / 60));
          const label = session.notes?.trim() || cardioTypeLabel(session.cardioType);
          return {
            id: session.id,
            name: label,
            date: session.startedAt,
            durationMinutes,
            exerciseCount: 0,
            totalSets: 0,
            totalVolume: 0,
            status: 'completed' as const,
            sessionKind: 'cardio' as const,
            cardioType: session.cardioType,
            distanceMeters: session.distanceMeters,
            caloriesBurned: session.caloriesBurned,
            avgHeartRate: session.avgHeartRate,
            notes: session.notes,
          };
        }),
      )
    : [];

  if (!workoutResult.success && !cardioResult.success) {
    return { success: false, error: workoutResult.error };
  }

  const page = mergeActivityHistoryPage({
    strength: strengthItems,
    cardio: cardioItems,
    // A record that failed to load has nothing more to offer this page; the other still pages on.
    strengthHasMore: workoutResult.success ? workoutResult.data.hasMore : false,
    cardioHasMore: cardioResult.success ? (cardioResult.hasMore ?? false) : false,
  });

  const strengthTotal = workoutResult.success ? workoutResult.data.total : 0;
  const cardioTotal = cardioResult.success ? (cardioResult.total ?? cardioItems.length) : 0;

  return {
    success: true,
    data: {
      data: page.items,
      nextBefore: page.nextBefore,
      hasMore: page.hasMore,
      totals: { strength: strengthTotal, cardio: cardioTotal, all: strengthTotal + cardioTotal },
    },
  };
}

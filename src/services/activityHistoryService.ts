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

export async function getCombinedActivityHistory(
  userId: string,
  page = 1,
): Promise<ServiceResult<{ data: WorkoutHistoryItem[]; hasMore: boolean }>> {
  const [workoutResult, cardioResult] = await Promise.all([
    workoutService.getHistory(userId, page),
    cardioService.getRecent(userId, 50),
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

  const merged = [...strengthItems, ...cardioItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (!workoutResult.success && !cardioResult.success) {
    return workoutResult.success === false
      ? { success: false, error: workoutResult.error }
      : { success: false, error: cardioResult.error };
  }

  return {
    success: true,
    data: {
      data: merged,
      hasMore: workoutResult.success ? workoutResult.data.hasMore : false,
    },
  };
}

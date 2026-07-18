import type { WorkoutHistoryItem } from '@/types/workout';

/** Keep the richer session when two cardio logs overlap the same morning window. */
export function dedupeOverlappingCardio(items: WorkoutHistoryItem[]): WorkoutHistoryItem[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const kept: WorkoutHistoryItem[] = [];

  for (const item of sorted) {
    const start = new Date(item.date).getTime();
    const end = start + item.durationMinutes * 60_000;
    const overlapIndex = kept.findIndex((existing) => {
      const existingStart = new Date(existing.date).getTime();
      const existingEnd = existingStart + existing.durationMinutes * 60_000;
      return start < existingEnd + 5 * 60_000 && end + 5 * 60_000 > existingStart;
    });

    if (overlapIndex < 0) {
      kept.push(item);
      continue;
    }

    const existing = kept[overlapIndex]!;
    const existingScore =
      (existing.distanceMeters ?? 0) + (existing.caloriesBurned ?? 0) * 10;
    const nextScore = (item.distanceMeters ?? 0) + (item.caloriesBurned ?? 0) * 10;
    if (nextScore > existingScore) {
      kept[overlapIndex] = item;
    }
  }

  return kept;
}

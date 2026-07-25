import { addCalendarDays } from '@/lib/localDate';
import type { Meal, MealStatus } from '@/types/nutrition';

const STATUS_RANK: Record<MealStatus, number> = {
  completed: 4,
  modified: 3,
  planned: 2,
  skipped: 1,
};

/**
 * Identity used for de-duplication. Only rows that provably describe the same
 * record collapse:
 *   - anything carrying the same client-generated key, and
 *   - plan slots for the same day + meal type, which repeated plan generation
 *     can create more than once.
 * A user-logged meal without a client key gets no key at all, so two snacks on
 * the same day are never mistaken for duplicates of each other.
 */
function mealIdentityKey(meal: Meal): string | null {
  if (meal.clientKey) return `key:${meal.clientKey}`;
  if (meal.origin !== 'plan' || !meal.scheduledDate) return null;
  return `plan:${meal.scheduledDate}:${meal.mealType}`;
}

/** Pick one keeper per meal identity; prefer completed/modified, then newest. */
export function pickMealsToKeep(meals: Meal[]): { keep: Meal[]; removeIds: string[] } {
  const groups = new Map<string, Meal[]>();
  const keep: Meal[] = [];
  const removeIds: string[] = [];

  for (const meal of meals) {
    const key = mealIdentityKey(meal);
    if (!key) {
      keep.push(meal);
      continue;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(meal);
    groups.set(key, bucket);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const rankDiff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
      if (rankDiff !== 0) return rankDiff;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });

    keep.push(sorted[0]);
    for (let index = 1; index < sorted.length; index += 1) {
      removeIds.push(sorted[index].id);
    }
  }

  return { keep, removeIds };
}

/** Untouched plan slots may be replaced by a regenerated plan; logs may not. */
export function isReplaceablePlannedMeal(meal: Meal): boolean {
  if (meal.origin !== 'plan') return false;
  return meal.status === 'planned' || meal.status === 'skipped';
}

export function weekEndDate(weekStart: string): string {
  return addCalendarDays(weekStart, 6);
}

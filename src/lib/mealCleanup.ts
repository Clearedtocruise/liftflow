import { addCalendarDays } from '@/lib/localDate';
import { enrichMealMeta } from '@/lib/mealIngredients';
import type { Meal } from '@/types/nutrition';

type MealStatus = 'planned' | 'completed' | 'modified' | 'skipped';

const STATUS_RANK: Record<MealStatus, number> = {
  completed: 4,
  modified: 3,
  planned: 2,
  skipped: 1,
};

function mealStatus(meal: Meal): MealStatus {
  return enrichMealMeta(meal.name, meal.instructions).status ?? 'planned';
}

function mealSlotKey(meal: Meal): string | null {
  if (!meal.scheduledDate) return null;
  return `${meal.scheduledDate}:${meal.mealType}`;
}

/** Pick one keeper per date+meal_type; prefer completed/modified, then newest. */
export function pickMealsToKeep(meals: Meal[]): { keep: Meal[]; removeIds: string[] } {
  const groups = new Map<string, Meal[]>();

  for (const meal of meals) {
    const key = mealSlotKey(meal);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(meal);
    groups.set(key, bucket);
  }

  const keep: Meal[] = [];
  const removeIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const rankDiff = STATUS_RANK[mealStatus(b)] - STATUS_RANK[mealStatus(a)];
      if (rankDiff !== 0) return rankDiff;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });

    keep.push(sorted[0]);
    for (let index = 1; index < sorted.length; index += 1) {
      removeIds.push(sorted[index].id);
    }
  }

  const slottedIds = new Set(keep.map((meal) => meal.id));
  for (const meal of meals) {
    if (!mealSlotKey(meal) && !slottedIds.has(meal.id)) {
      keep.push(meal);
    }
  }

  return { keep, removeIds };
}

export function isReplaceablePlannedMeal(meal: Meal): boolean {
  const status = mealStatus(meal);
  return status === 'planned' || status === 'skipped';
}

export function weekEndDate(weekStart: string): string {
  return addCalendarDays(weekStart, 6);
}

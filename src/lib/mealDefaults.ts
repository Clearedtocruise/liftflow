/**
 * Learns the meal you actually keep eating in each slot.
 *
 * The plan rotates template meals by day index, so eating the same breakfast every morning still
 * produced a different suggestion tomorrow. Counting what you log turns a repeat into the usual.
 */

import type { MealType } from '@/types/common';
import type { Meal } from '@/types/nutrition';

/** Logged this many times in a slot and it stops being a coincidence. */
export const USUAL_MEAL_THRESHOLD = 3;

/** Only recent history counts, so last month's cut does not haunt this month's plan. */
export const USUAL_MEAL_WINDOW_DAYS = 45;

export type MealDefault = {
  mealType: MealType;
  name: string;
  useCount: number;
  lastUsedAt: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  instructions?: string;
};

/** Same meal typed slightly differently should not split the count. */
export function normalizeMealName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isConsumed(meal: Meal): boolean {
  return meal.status === 'completed' || meal.status === 'modified';
}

function mealTime(meal: Meal): number {
  const iso = meal.consumedAt ?? (meal.scheduledDate ? `${meal.scheduledDate}T12:00:00` : undefined);
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Counts consumed meals per (slot, name). One entry per calendar day per slot, so tapping a
 * button twice on the same breakfast cannot promote it on its own.
 */
export function tallyMealDefaults(
  meals: Meal[],
  options?: { now?: Date; windowDays?: number },
): MealDefault[] {
  const now = options?.now ?? new Date();
  const windowDays = options?.windowDays ?? USUAL_MEAL_WINDOW_DAYS;
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const byKey = new Map<string, MealDefault & { days: Set<string> }>();

  for (const meal of meals) {
    if (!isConsumed(meal)) continue;
    if (!meal.name?.trim()) continue;

    const time = mealTime(meal);
    if (time < cutoff) continue;

    const normalized = normalizeMealName(meal.name);
    if (!normalized) continue;

    const key = `${meal.mealType}::${normalized}`;
    const day = meal.scheduledDate ?? new Date(time).toISOString().slice(0, 10);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        mealType: meal.mealType,
        name: meal.name.trim(),
        useCount: 1,
        lastUsedAt: new Date(time).toISOString(),
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        instructions: meal.instructions,
        days: new Set([day]),
      });
      continue;
    }

    if (!existing.days.has(day)) {
      existing.days.add(day);
      existing.useCount += 1;
    }

    if (time > new Date(existing.lastUsedAt).getTime()) {
      existing.lastUsedAt = new Date(time).toISOString();
      // Keep the most recent macros — portions drift over time.
      existing.calories = meal.calories ?? existing.calories;
      existing.proteinG = meal.proteinG ?? existing.proteinG;
      existing.carbsG = meal.carbsG ?? existing.carbsG;
      existing.fatG = meal.fatG ?? existing.fatG;
      existing.instructions = meal.instructions ?? existing.instructions;
    }
  }

  return [...byKey.values()]
    .map(({ days, ...rest }) => rest)
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
    });
}

/** The winning meal per slot, once it clears the repeat threshold. */
export function resolveUsualMeals(
  meals: Meal[],
  options?: { now?: Date; windowDays?: number; threshold?: number },
): Map<MealType, MealDefault> {
  const threshold = options?.threshold ?? USUAL_MEAL_THRESHOLD;
  const usual = new Map<MealType, MealDefault>();

  for (const entry of tallyMealDefaults(meals, options)) {
    if (entry.useCount < threshold) continue;
    if (!usual.has(entry.mealType)) usual.set(entry.mealType, entry);
  }

  return usual;
}

/** The usual for a slot, when it is not already what is planned. */
export function usualMealSuggestion(
  meal: Pick<Meal, 'mealType' | 'name' | 'status'>,
  usual: Map<MealType, MealDefault>,
): MealDefault | undefined {
  if (meal.status === 'completed' || meal.status === 'modified') return undefined;

  const candidate = usual.get(meal.mealType);
  if (!candidate) return undefined;
  if (normalizeMealName(candidate.name) === normalizeMealName(meal.name)) return undefined;
  return candidate;
}

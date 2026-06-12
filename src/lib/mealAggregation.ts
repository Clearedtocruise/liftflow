import { pickMealsToKeep } from '@/lib/mealCleanup';
import { enrichMealMeta } from '@/lib/mealIngredients';
import type { MealType } from '@/types/common';
import type { Meal } from '@/types/nutrition';

const MEAL_TYPE_ORDER: Record<MealType, number> = {
  pre_workout: 0,
  breakfast: 1,
  snack: 2,
  lunch: 3,
  post_workout: 4,
  dinner: 5,
};

export type DailyMealAggregation = {
  dedupedMeals: Meal[];
  caloriesConsumed: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsCompleted: number;
  mealsTotal: number;
  plannedCalories: number;
  plannedProteinG: number;
};

function mealStatus(meal: Meal) {
  return enrichMealMeta(meal.name, meal.instructions).status ?? 'planned';
}

/** Counts toward daily consumed macros (not skipped plan slots). */
export function isConsumedMeal(meal: Meal): boolean {
  const status = mealStatus(meal);
  if (status === 'completed' || status === 'modified') return true;
  if (!meal.mealPlanId && status !== 'skipped') return true;
  return false;
}

function isScheduledMeal(meal: Meal): boolean {
  return mealStatus(meal) !== 'skipped';
}

/** Keep the newest row per meal type to avoid duplicate weekly plan inserts. */
export function dedupeMealsByType(meals: Meal[]): Meal[] {
  const { keep } = pickMealsToKeep(meals);
  return keep.sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);
}

export function aggregateDailyMeals(meals: Meal[]): DailyMealAggregation {
  const dedupedMeals = dedupeMealsByType(meals).filter(isScheduledMeal);

  let caloriesConsumed = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  for (const meal of dedupeMealsByType(meals)) {
    if (!isConsumedMeal(meal)) continue;
    caloriesConsumed += meal.calories ?? 0;
    proteinG += Number(meal.proteinG ?? 0);
    carbsG += Number(meal.carbsG ?? 0);
    fatG += Number(meal.fatG ?? 0);
  }

  const mealsCompleted = dedupedMeals.filter((meal) => {
    const status = mealStatus(meal);
    return status === 'completed' || status === 'modified';
  }).length;

  return {
    dedupedMeals,
    caloriesConsumed,
    proteinG,
    carbsG,
    fatG,
    mealsCompleted,
    mealsTotal: dedupedMeals.length,
    plannedCalories: dedupedMeals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0),
    plannedProteinG: dedupedMeals.reduce((sum, meal) => sum + Number(meal.proteinG ?? 0), 0),
  };
}

export function findNextMeal(
  meals: Meal[],
  scheduledTimes: string[],
): { meal: Meal; scheduledTime: string } | null {
  const deduped = dedupeMealsByType(meals).filter(isScheduledMeal);

  for (let index = 0; index < deduped.length; index += 1) {
    const meal = deduped[index];
    if (isConsumedMeal(meal)) continue;
    return { meal, scheduledTime: scheduledTimes[index] ?? '' };
  }

  return null;
}

export function trainingLabelFromRecoveryScore(score: number): string {
  if (score >= 75) return 'Train';
  if (score >= 55) return 'Train Light';
  if (score >= 40) return 'Recovery Session';
  return 'Rest Day';
}

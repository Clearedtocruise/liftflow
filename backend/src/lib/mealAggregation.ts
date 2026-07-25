import { mealStatus, pickMealsToKeep, type MealCleanupRow, type MealStatus } from './mealCleanup.js';

export type { MealStatus };
export type MealRow = MealCleanupRow;

const MEAL_TYPE_ORDER: Record<string, number> = {
  pre_workout: 0,
  breakfast: 1,
  snack: 2,
  lunch: 3,
  post_workout: 4,
  dinner: 5,
};

export type DailyMealAggregation = {
  caloriesConsumed: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsCompleted: number;
  mealsTotal: number;
  plannedCalories: number;
  plannedProteinG: number;
};

export type WeeklyMealAggregation = DailyMealAggregation & {
  byDate: Record<string, DailyMealAggregation>;
};

/**
 * Counts toward daily consumed macros. Only an explicit completed/modified
 * status counts — a plan slot the user never touched is not food they ate.
 */
export function isConsumedMeal(meal: MealRow): boolean {
  const status = mealStatus(meal);
  return status === 'completed' || status === 'modified';
}

function isScheduledMeal(meal: MealRow): boolean {
  return mealStatus(meal) !== 'skipped';
}

export function dedupeMealsByType(meals: MealRow[]): MealRow[] {
  const { keep } = pickMealsToKeep(meals);
  return keep.sort((a, b) => (MEAL_TYPE_ORDER[a.meal_type] ?? 99) - (MEAL_TYPE_ORDER[b.meal_type] ?? 99));
}

export function aggregateDailyMeals(meals: MealRow[]): DailyMealAggregation {
  const dedupedMeals = dedupeMealsByType(meals).filter(isScheduledMeal);

  let caloriesConsumed = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;

  for (const meal of dedupeMealsByType(meals)) {
    if (!isConsumedMeal(meal)) continue;
    caloriesConsumed += Number(meal.calories ?? 0);
    proteinG += Number(meal.protein_g ?? 0);
    carbsG += Number(meal.carbs_g ?? 0);
    fatG += Number(meal.fat_g ?? 0);
  }

  const mealsCompleted = dedupedMeals.filter((meal) => {
    const status = mealStatus(meal);
    return status === 'completed' || status === 'modified';
  }).length;

  return {
    caloriesConsumed,
    proteinG,
    carbsG,
    fatG,
    mealsCompleted,
    mealsTotal: dedupedMeals.length,
    plannedCalories: dedupedMeals.reduce((sum, meal) => sum + Number(meal.calories ?? 0), 0),
    plannedProteinG: dedupedMeals.reduce((sum, meal) => sum + Number(meal.protein_g ?? 0), 0),
  };
}

export function aggregateWeeklyMeals(meals: MealRow[]): WeeklyMealAggregation {
  const byDate: Record<string, DailyMealAggregation> = {};
  const dates = [...new Set(meals.map((meal) => meal.scheduled_date).filter(Boolean))] as string[];

  for (const date of dates) {
    byDate[date] = aggregateDailyMeals(meals.filter((meal) => meal.scheduled_date === date));
  }

  const weekTotals = Object.values(byDate).reduce<DailyMealAggregation>(
    (totals, day) => ({
      caloriesConsumed: totals.caloriesConsumed + day.caloriesConsumed,
      proteinG: totals.proteinG + day.proteinG,
      carbsG: totals.carbsG + day.carbsG,
      fatG: totals.fatG + day.fatG,
      mealsCompleted: totals.mealsCompleted + day.mealsCompleted,
      mealsTotal: totals.mealsTotal + day.mealsTotal,
      plannedCalories: totals.plannedCalories + day.plannedCalories,
      plannedProteinG: totals.plannedProteinG + day.plannedProteinG,
    }),
    {
      caloriesConsumed: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      mealsCompleted: 0,
      mealsTotal: 0,
      plannedCalories: 0,
      plannedProteinG: 0,
    },
  );

  return { ...weekTotals, byDate };
}

/** Distinct dates in range with at least one consumed meal after dedupe. */
export function countNutritionLogDays(meals: MealRow[]): number {
  const dates = new Set<string>();
  const byDate = new Map<string, MealRow[]>();

  for (const meal of meals) {
    if (!meal.scheduled_date) continue;
    const bucket = byDate.get(meal.scheduled_date) ?? [];
    bucket.push(meal);
    byDate.set(meal.scheduled_date, bucket);
  }

  for (const [date, dayMeals] of byDate.entries()) {
    const aggregated = aggregateDailyMeals(dayMeals);
    if (aggregated.caloriesConsumed > 0 || aggregated.mealsCompleted > 0) {
      dates.add(date);
    }
  }

  return dates.size;
}

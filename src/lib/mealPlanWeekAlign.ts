import { addCalendarDays } from '@/lib/localDate';
import type { MealType } from '@/types/common';

export type ApiPlanMeal = {
  mealType: MealType;
  name: string;
  scheduledDate: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  instructions?: string;
};

export const MEAL_PLAN_TYPES: MealType[] = [
  'pre_workout',
  'post_workout',
  'breakfast',
  'lunch',
  'snack',
  'dinner',
];

/** Monday-start week containing the given YYYY-MM-DD (matches getWeekRange). */
export function weekDatesFromStart(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
}

/** Align API week dates (server UTC) with the user's local calendar week by day index. */
export function remapApiMealsToClientWeek(
  meals: ApiPlanMeal[],
  apiWeekStart: string,
  clientWeekStart: string,
): ApiPlanMeal[] {
  if (apiWeekStart === clientWeekStart) return meals;

  const apiDates = weekDatesFromStart(apiWeekStart);
  const clientDates = weekDatesFromStart(clientWeekStart);

  return meals.map((meal) => {
    const dateKey = meal.scheduledDate.slice(0, 10);
    const dayIndex = apiDates.indexOf(dateKey);
    if (dayIndex < 0) return meal;
    return { ...meal, scheduledDate: clientDates[dayIndex]! };
  });
}

export function mealSlotKey(scheduledDate: string, mealType: MealType): string {
  return `${scheduledDate.slice(0, 10)}:${mealType}`;
}

import { adaptMealName, inferDietaryStyle, type NutritionPreferenceInput } from './dietaryRestrictions.js';
import { calculateMacroTargets, generateDailyMeals } from './workoutAwareNutrition.js';

export { adaptMealName, inferDietaryStyle };
export type { NutritionPreferenceInput };

export type MealSwap = {
  from: string;
  to: string;
  date: string;
  mealType: string;
  reason: string;
};

export function buildMealPlanForDate(
  date: string,
  prefs: NutritionPreferenceInput,
  macros = calculateMacroTargets({ goal: 'general_fitness', dietaryStyle: inferDietaryStyle(prefs.dietaryRestrictions) }),
) {
  const style = inferDietaryStyle(prefs.dietaryRestrictions);
  const meals = generateDailyMeals(date, macros, style);
  const count = prefs.mealsPerDay ?? 4;
  const allowedTypes =
    count <= 3
      ? (['breakfast', 'lunch', 'dinner'] as const)
      : count === 4
        ? (['breakfast', 'lunch', 'dinner', 'snack'] as const)
        : (['breakfast', 'lunch', 'dinner', 'snack'] as const);

  return allowedTypes.map((mealType) => {
    const base = meals.find((meal) => meal.mealType === mealType) ?? meals[0];
    const adapted = adaptMealName(base.name, mealType, prefs);
    return {
      mealType,
      name: adapted.name,
      scheduledDate: date,
      calories: base.calories,
      proteinG: base.proteinG,
      carbsG: base.carbsG,
      fatG: base.fatG,
      reason: adapted.reason,
    };
  });
}

export function parseMealStatus(instructions: string | null | undefined): 'planned' | 'completed' | 'modified' | 'skipped' {
  if (!instructions) return 'planned';
  try {
    const parsed = JSON.parse(instructions) as { status?: string };
    if (parsed.status === 'completed' || parsed.status === 'modified' || parsed.status === 'skipped') {
      return parsed.status;
    }
    return 'planned';
  } catch {
    return 'planned';
  }
}

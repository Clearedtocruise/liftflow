import {
  enrichMealMeta,
  mealNameFromIngredients,
  serializeMealMeta,
  type MealIngredient,
  type MealMacros,
} from '@/lib/mealIngredients';
import { estimateFoodMacrosLocal } from '@/lib/foodMacroLookup';
import { dedupeMealsByType } from '@/lib/mealAggregation';
import type { MealReplacementScope } from '@/types/nutrition';
import type { Meal } from '@/types';

export type SmartReplacementInput = {
  foodName: string;
  servingSize: string;
  macros: MealMacros;
};

function mealKey(name: string): string {
  return name.trim().toLowerCase();
}

function ingredientMatches(a: string, b: string): boolean {
  return mealKey(a) === mealKey(b);
}

export function selectMealsForScope(
  anchor: Meal,
  allMeals: Meal[],
  scope: MealReplacementScope,
  targetIngredient?: string,
): Meal[] {
  if (scope === 'meal') return [anchor];

  const candidateMeals =
    scope === 'day'
      ? dedupeMealsByType(allMeals.filter((meal) => meal.scheduledDate === anchor.scheduledDate))
      : dedupeMealsByType(allMeals);

  if (scope === 'day') {
    return candidateMeals.filter((meal) => {
      if (targetIngredient) {
        const meta = enrichMealMeta(meal.name, meal.instructions);
        return (meta.ingredients ?? []).some((item) => ingredientMatches(item.name, targetIngredient));
      }
      return meal.mealType === anchor.mealType || mealKey(meal.name) === mealKey(anchor.name);
    });
  }

  return candidateMeals.filter((meal) => {
    if (targetIngredient) {
      const meta = enrichMealMeta(meal.name, meal.instructions);
      return (meta.ingredients ?? []).some((item) => ingredientMatches(item.name, targetIngredient));
    }
    return meal.mealType === anchor.mealType && mealKey(meal.name) === mealKey(anchor.name);
  });
}

function estimateIngredientMacros(ingredient: MealIngredient): MealMacros {
  return estimateFoodMacrosLocal(ingredient.name, ingredient.serving);
}

function roundMacros(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildSmartIngredientReplacementUpdate(
  meal: Meal,
  ingredientName: string,
  replacement: SmartReplacementInput,
): Partial<Meal> & { instructions: string } {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  const ingredients = meta.ingredients ?? [];
  meta.ingredients = ingredients.map((item) =>
    ingredientMatches(item.name, ingredientName)
      ? { name: replacement.foodName, serving: replacement.servingSize }
      : item,
  );
  meta.status = 'planned';
  const nextIngredients = meta.ingredients ?? [];
  const nextName = mealNameFromIngredients(nextIngredients) ?? meal.name;
  const nextMacros = nextIngredients.reduce<MealMacros>(
    (acc, item) => {
      const estimate = ingredientMatches(item.name, replacement.foodName) && item.serving === replacement.servingSize
        ? replacement.macros
        : estimateIngredientMacros(item);
      return {
        calories: acc.calories + estimate.calories,
        proteinG: roundMacros(acc.proteinG + estimate.proteinG),
        carbsG: roundMacros(acc.carbsG + estimate.carbsG),
        fatG: roundMacros(acc.fatG + estimate.fatG),
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return {
    name: nextName,
    // Swapping an ingredient changes the plan; the macros only count once it is marked eaten.
    status: 'planned',
    calories: Math.max(0, Math.round(nextMacros.calories)),
    proteinG: Math.max(0, nextMacros.proteinG),
    carbsG: Math.max(0, nextMacros.carbsG),
    fatG: Math.max(0, nextMacros.fatG),
    instructions: serializeMealMeta(meta),
  };
}

export function buildSmartMealReplacementUpdate(
  meal: Meal,
  replacement: SmartReplacementInput,
): Partial<Meal> & { instructions: string } {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  // Replace edits the plan only — macros count when the user taps Ate as planned.
  meta.status = 'planned';
  meta.ingredients = [{ name: replacement.foodName, serving: replacement.servingSize }];

  return {
    name: replacement.foodName,
    status: 'planned',
    calories: replacement.macros.calories,
    proteinG: replacement.macros.proteinG,
    carbsG: replacement.macros.carbsG,
    fatG: replacement.macros.fatG,
    instructions: serializeMealMeta(meta),
  };
}

export function buildSmartReplacementUpdate(
  meal: Meal,
  mode: 'meal' | 'ingredient',
  ingredientName: string | undefined,
  replacement: SmartReplacementInput,
): Partial<Meal> & { instructions: string } {
  if (mode === 'ingredient' && ingredientName) {
    return buildSmartIngredientReplacementUpdate(meal, ingredientName, replacement);
  }
  return buildSmartMealReplacementUpdate(meal, replacement);
}

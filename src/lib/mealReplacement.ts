import {
  enrichMealMeta,
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

export function buildSmartIngredientReplacementUpdate(
  meal: Meal,
  ingredientName: string,
  replacement: SmartReplacementInput,
): Partial<Meal> & { instructions: string } {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  const ingredients = meta.ingredients ?? [];
  const target = ingredients.find((item) => ingredientMatches(item.name, ingredientName));
  const oldMacros = target ? estimateIngredientMacros(target) : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  meta.ingredients = ingredients.map((item) =>
    ingredientMatches(item.name, ingredientName)
      ? { name: replacement.foodName, serving: replacement.servingSize }
      : item,
  );
  meta.status = 'modified';

  return {
    calories: Math.max(0, Math.round((meal.calories ?? 0) - oldMacros.calories + replacement.macros.calories)),
    proteinG: Math.max(0, Math.round(((meal.proteinG ?? 0) - oldMacros.proteinG + replacement.macros.proteinG) * 10) / 10),
    carbsG: Math.max(0, Math.round(((meal.carbsG ?? 0) - oldMacros.carbsG + replacement.macros.carbsG) * 10) / 10),
    fatG: Math.max(0, Math.round(((meal.fatG ?? 0) - oldMacros.fatG + replacement.macros.fatG) * 10) / 10),
    instructions: serializeMealMeta(meta),
  };
}

export function buildSmartMealReplacementUpdate(
  meal: Meal,
  replacement: SmartReplacementInput,
): Partial<Meal> & { instructions: string } {
  const meta = enrichMealMeta(meal.name, meal.instructions);
  meta.status = 'modified';
  meta.ingredients = [{ name: replacement.foodName, serving: replacement.servingSize }];

  return {
    name: replacement.foodName,
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

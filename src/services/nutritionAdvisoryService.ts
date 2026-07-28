import { apiClient } from '@/api/client';
import { estimateFoodMacrosLocal } from '@/lib/foodMacroLookup';
import {
  alternativesForIngredient,
  buildLocalMealAlternatives,
  enrichMealMeta,
  type MealReplacementReason,
} from '@/lib/mealIngredients';
import { reconcileFoodMacroEstimate } from '@/lib/reconcileFoodMacroEstimate';
import { ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { FoodMacroEstimate } from '@/types/nutrition';
import type { Meal } from '@/types';

export type MealAlternativeOption = {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ name: string; serving: string }>;
};

export type MealAlternativesResult = {
  reasoning: string;
  alternatives: MealAlternativeOption[];
  ingredientAlternatives: Array<{ from: string; to: string; reason: string }>;
  offline?: boolean;
};

export const nutritionAdvisoryService = {
  async getMealAlternatives(
    meal: Meal,
    reason: MealReplacementReason,
    dietaryRestrictions: string[] = [],
  ) {
    const meta = enrichMealMeta(meal.name, meal.instructions);
    try {
      const token = await getAccessToken();
      const raw = await apiClient.post<{ data: MealAlternativesResult }>(
        '/api/ai/advisory/nutrition/meal-alternatives',
        {
          mealName: meal.name,
          reason,
          mealType: meal.mealType,
          ingredients: meta.ingredients ?? [],
          dietaryRestrictions,
        },
        token,
      );

      if (raw.data?.alternatives?.length) {
        return ok(raw.data);
      }
    } catch (e) {
      // Fall through to local templates when API unavailable.
      if (__DEV__) {
        console.warn('[nutritionAdvisoryService] meal alternatives fallback', e);
      }
    }

    const local = buildLocalMealAlternatives(meal.name, reason);
    const ingredientAlternatives = (meta.ingredients ?? []).slice(0, 4).map((item) => ({
      from: item.name,
      to: alternativesForIngredient(item.name)[0] ?? item.name,
      reason: 'Local substitute suggestion',
    }));

    return ok({
      reasoning: 'Showing on-device meal suggestions while coach AI is unavailable.',
      alternatives: local,
      ingredientAlternatives,
      offline: true,
    } satisfies MealAlternativesResult);
  },

  async estimateFoodMacros(foodName: string, servingSize: string) {
    const local = estimateFoodMacrosLocal(foodName, servingSize);
    try {
      const token = await getAccessToken();
      const raw = await apiClient.post<{ data: FoodMacroEstimate }>(
        '/api/ai/advisory/nutrition/food-macros',
        { foodName, servingSize },
        token,
      );

      if (raw.data?.calories != null) {
        const reconciled = reconcileFoodMacroEstimate(raw.data);
        // If the model narrated multiple foods but returned a single-food tile (eggs without
        // whites), prefer the on-device split that actually added every part.
        const aiDroppedParts =
          local.calories > reconciled.calories * 1.12 &&
          local.proteinG > reconciled.proteinG + 4;
        if (aiDroppedParts) {
          return ok(
            reconcileFoodMacroEstimate({
              ...local,
              reasoning: `On-device estimate for ${foodName} (${servingSize}): ${local.calories} cal, ${local.proteinG}g protein, ${local.carbsG}g carbs, ${local.fatG}g fat.`,
            }),
          );
        }
        return ok(reconciled);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[nutritionAdvisoryService] food macros fallback', e);
      }
    }

    return ok(
      reconcileFoodMacroEstimate({
        ...local,
        reasoning: 'On-device macro estimate while coach AI is unavailable.',
      }),
    );
  },
};

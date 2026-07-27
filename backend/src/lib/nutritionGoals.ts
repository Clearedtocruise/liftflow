/**
 * Deciding the macro targets a generated meal plan should be saved against.
 *
 * Meal-plan generation used to read `nutrition_goals` and fall back to hard-coded numbers when the
 * row was missing, so a user who generated a plan without going through coach activation ended up
 * with meals built around 180g of protein and nothing anywhere recording that as their goal. Every
 * surface that compares intake to a target — the home protein tile most visibly — then had nothing
 * to compare against.
 */

export type MacroSplit = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type StoredNutritionGoals = {
  daily_calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
} | null;

/** Matches the ratios in `calculateMacroTargets`, so a derived split cannot contradict a computed one. */
const CARB_RATIO = 0.4;
const FAT_RATIO = 0.25;

/** Fills in carbohydrate and fat when only calories and protein are known. */
export function deriveMacroSplit(calories: number, proteinG: number): MacroSplit {
  return {
    calories,
    proteinG,
    carbsG: Math.round((calories * CARB_RATIO) / 4),
    fatG: Math.round((calories * FAT_RATIO) / 9),
  };
}

/**
 * The targets the plan was actually built around, in priority order: the coach's computed macros,
 * then any saved goal, then the caller's defaults. Carbohydrate and fat follow whichever source
 * supplied the calories so the four numbers always describe one coherent plan.
 */
export function resolvePlanMacroTargets(input: {
  macroTargets?: Partial<MacroSplit> | null;
  existing?: StoredNutritionGoals;
  fallback: { calories: number; proteinG: number };
}): MacroSplit {
  const { macroTargets, existing, fallback } = input;

  if (macroTargets?.calories && macroTargets.proteinG) {
    return {
      calories: Math.round(macroTargets.calories),
      proteinG: Math.round(macroTargets.proteinG),
      carbsG: Math.round(macroTargets.carbsG ?? deriveMacroSplit(macroTargets.calories, macroTargets.proteinG).carbsG),
      fatG: Math.round(macroTargets.fatG ?? deriveMacroSplit(macroTargets.calories, macroTargets.proteinG).fatG),
    };
  }

  if (existing?.daily_calories && existing.protein_g) {
    const derived = deriveMacroSplit(existing.daily_calories, existing.protein_g);
    return {
      calories: Math.round(existing.daily_calories),
      proteinG: Math.round(existing.protein_g),
      carbsG: Math.round(existing.carbs_g ?? derived.carbsG),
      fatG: Math.round(existing.fat_g ?? derived.fatG),
    };
  }

  return deriveMacroSplit(Math.round(fallback.calories), Math.round(fallback.proteinG));
}

/**
 * True when the saved goal does not already describe these targets.
 *
 * Generating a plan is a routine action, so rewriting an identical row every time would churn the
 * history that `effective_from` exists to record.
 */
export function nutritionGoalsNeedUpdate(existing: StoredNutritionGoals, next: MacroSplit): boolean {
  if (!existing) return true;
  if (existing.daily_calories == null || existing.protein_g == null) return true;
  return (
    Math.round(existing.daily_calories) !== next.calories ||
    Math.round(existing.protein_g) !== next.proteinG
  );
}

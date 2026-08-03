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

/** Minimal shape of the Supabase client used here, so this stays unit-testable. */
type GoalsDb = {
  from: (table: string) => any;
};

/**
 * Closes the current goal row and opens a new one.
 *
 * `nutrition_goals` is an effective-dated history rather than a mutable row, so a change has to
 * deactivate the old record and insert a new one. Anything that changes a user's targets must go
 * through here, otherwise the Nutrition tab keeps reading the superseded row.
 */
export async function persistNutritionGoals(
  db: GoalsDb,
  userId: string,
  targets: MacroSplit,
  effectiveFrom?: string,
): Promise<void> {
  await db.from('nutrition_goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
  await db.from('nutrition_goals').insert({
    user_id: userId,
    daily_calories: targets.calories,
    protein_g: targets.proteinG,
    carbs_g: targets.carbsG,
    fat_g: targets.fatG,
    water_ml: 3000,
    is_active: true,
    effective_from: effectiveFrom ?? new Date().toISOString().slice(0, 10),
  });
}

/**
 * Apply an imported nutrition blueprint as the athlete's trackable week plan.
 *
 * Sticky via profiles.metadata.importedNutrition + coachProfile.nutritionPlanPack so regenerate /
 * reload can re-apply the same meals instead of inventing a new template week.
 */

import {
  isReplaceablePlannedMeal,
  MEAL_COLUMNS,
  removePlannedMealsForWeek,
  type MealCleanupRow,
} from './mealCleanup.js';
import { persistNutritionGoals } from './nutritionGoals.js';
import type { ImportedMeal, ImportedNutritionDay, ImportedNutritionPlan } from './pdfProgramParse.js';
import { addDays } from './programTypes.js';
import { cutPlanWeekWindow } from './personalPlans/cutPlanWeek.js';
import { requireAdmin } from './supabase.js';

export const IMPORTED_NUTRITION_PLAN_PACK = 'imported_pdf';

export type ApplyImportedNutritionResult = {
  planPack: typeof IMPORTED_NUTRITION_PLAN_PACK;
  weekStart: string;
  mealsInserted: number;
  mealsCleared: number;
  goalsUpdated: boolean;
};

const KNOWN_MEAL_TYPES: ImportedMeal['mealType'][] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
];
const DAYS_IN_WEEK = 7;
const MAX_MEALS_PER_DAY = 12;
const MAX_TEXT = 160;

function clampNumber(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.round(value), max);
}

function clampText(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/**
 * Bring an imported plan back inside the bounds the rest of the pipeline assumes.
 *
 * The commit endpoint accepts the plan the user reviewed and corrected on device, so `dayIndex` and
 * every macro now arrive from the client rather than from this server's own parser. `dayIndex` is
 * added directly to the week start, so an out-of-range one would scatter meals outside the week it
 * is meant to fill.
 */
export function normalizeImportedNutritionPlan(plan: ImportedNutritionPlan): ImportedNutritionPlan {
  const byDayIndex = new Map<number, ImportedNutritionDay>();

  for (const day of plan.days ?? []) {
    const dayIndex = Math.trunc(Number(day?.dayIndex));
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= DAYS_IN_WEEK) continue;

    const meals: ImportedMeal[] = [];
    for (const meal of day.meals ?? []) {
      const name = clampText(meal?.name, 120);
      if (!name) continue;
      const mealType = (clampText(meal?.mealType, 24) ?? '').toLowerCase();
      meals.push({
        mealType: KNOWN_MEAL_TYPES.find((known) => known === mealType) ?? 'snack',
        name,
        scheduledTime: clampText(meal?.scheduledTime, 16),
        calories: clampNumber(meal?.calories, 5_000),
        proteinG: clampNumber(meal?.proteinG, 1_000),
        carbsG: clampNumber(meal?.carbsG, 1_000),
        fatG: clampNumber(meal?.fatG, 1_000),
        notes: clampText(meal?.notes, 400),
      });
      if (meals.length >= MAX_MEALS_PER_DAY) break;
    }

    const existing = byDayIndex.get(dayIndex);
    if (existing) {
      existing.meals = [...existing.meals, ...meals].slice(0, MAX_MEALS_PER_DAY);
      existing.label = existing.label ?? clampText(day.label, 60);
      continue;
    }
    byDayIndex.set(dayIndex, { dayIndex, label: clampText(day.label, 60), meals });
  }

  const goals = {
    calories: clampNumber(plan.goals?.calories, 10_000),
    proteinG: clampNumber(plan.goals?.proteinG, 2_000),
    carbsG: clampNumber(plan.goals?.carbsG, 2_000),
    fatG: clampNumber(plan.goals?.fatG, 2_000),
    waterMl: clampNumber(plan.goals?.waterMl, 20_000),
  };
  const hasGoal = Object.values(goals).some((value) => value != null);

  return {
    name: clampText(plan.name, 80),
    goals: hasGoal ? goals : undefined,
    days: [...byDayIndex.values()].sort((a, b) => a.dayIndex - b.dayIndex),
  };
}

function mealClientKey(date: string, mealType: string, name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `import:${IMPORTED_NUTRITION_PLAN_PACK}:${date}:${mealType}:${slug}:${index}`;
}

async function clearPriorImportedMeals(
  db: ReturnType<typeof requireAdmin>,
  userId: string,
): Promise<number> {
  const { data, error } = await db
    .from('meals')
    .select(MEAL_COLUMNS)
    .eq('user_id', userId)
    .like('client_key', `import:${IMPORTED_NUTRITION_PLAN_PACK}:%`);
  if (error) throw new Error(error.message);

  const removeIds = ((data ?? []) as MealCleanupRow[])
    .filter(isReplaceablePlannedMeal)
    .map((row) => row.id);
  if (removeIds.length === 0) return 0;

  const { error: deleteError } = await db.from('meals').delete().in('id', removeIds);
  if (deleteError) throw new Error(deleteError.message);
  return removeIds.length;
}

/** Persist blueprint on the profile so weekly reload can re-apply without re-uploading the PDF. */
export async function storeImportedNutritionBlueprint(
  userId: string,
  plan: ImportedNutritionPlan,
): Promise<void> {
  const db = requireAdmin();
  const { data: profile } = await db
    .from('profiles')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();
  const existingMeta = (profile?.metadata ?? {}) as Record<string, unknown>;
  const coachProfile = {
    ...((existingMeta.coachProfile as Record<string, unknown>) ?? {}),
    nutritionPlanPack: IMPORTED_NUTRITION_PLAN_PACK,
    selfDirectedNutrition: false,
  };
  await db
    .from('profiles')
    .update({
      metadata: {
        ...existingMeta,
        coachProfile,
        importedNutrition: {
          planPack: IMPORTED_NUTRITION_PLAN_PACK,
          name: plan.name ?? 'Imported Nutrition Plan',
          goals: plan.goals ?? null,
          days: plan.days,
          savedAt: new Date().toISOString(),
        },
      },
    })
    .eq('id', userId);
}

export async function loadStoredImportedNutrition(
  userId: string,
): Promise<ImportedNutritionPlan | null> {
  const db = requireAdmin();
  const { data: profile } = await db
    .from('profiles')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();
  const meta = (profile?.metadata ?? {}) as {
    coachProfile?: { nutritionPlanPack?: string };
    importedNutrition?: ImportedNutritionPlan & { planPack?: string };
  };
  if (meta.coachProfile?.nutritionPlanPack !== IMPORTED_NUTRITION_PLAN_PACK) return null;
  const stored = meta.importedNutrition;
  if (!stored || !Array.isArray(stored.days)) return null;
  return {
    name: stored.name,
    goals: stored.goals,
    days: stored.days,
  };
}

export async function applyImportedNutritionPlan(
  userId: string,
  rawPlan: ImportedNutritionPlan,
  options?: { persistBlueprint?: boolean },
): Promise<ApplyImportedNutritionResult> {
  const db = requireAdmin();
  const persistBlueprint = options?.persistBlueprint !== false;
  // Normalized here rather than at the route so the blueprint stored for weekly reload is the same
  // bounded plan that gets written this week.
  const plan = normalizeImportedNutritionPlan(rawPlan);

  const { data: profile } = await db
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  const { weekStart, weekEnd } = cutPlanWeekWindow(
    new Date(),
    profile?.timezone as string | null | undefined,
  );

  let goalsUpdated = false;
  if (plan.goals && (plan.goals.calories || plan.goals.proteinG || plan.goals.carbsG || plan.goals.fatG)) {
    await persistNutritionGoals(db, userId, {
      calories: plan.goals.calories ?? 2200,
      proteinG: plan.goals.proteinG ?? 160,
      carbsG: plan.goals.carbsG ?? 200,
      fatG: plan.goals.fatG ?? 70,
    });
    if (plan.goals.waterMl && plan.goals.waterMl > 0) {
      await db
        .from('nutrition_goals')
        .update({ water_ml: plan.goals.waterMl })
        .eq('user_id', userId)
        .eq('is_active', true);
    }
    goalsUpdated = true;
  }

  if (persistBlueprint) {
    await storeImportedNutritionBlueprint(userId, plan);
  }

  const priorCleared = await clearPriorImportedMeals(db, userId);
  const weekCleared = await removePlannedMealsForWeek(db, userId, weekStart, weekEnd);
  const mealsCleared = priorCleared + weekCleared;

  if (plan.days.length === 0) {
    return {
      planPack: IMPORTED_NUTRITION_PLAN_PACK,
      weekStart,
      mealsInserted: 0,
      mealsCleared,
      goalsUpdated,
    };
  }

  const { data: mealPlan, error: mealPlanError } = await db
    .from('meal_plans')
    .insert({
      user_id: userId,
      name: plan.name ?? 'Imported Nutrition Plan',
      week_start_date: weekStart,
      ai_generated: false,
      ai_rationale: 'Imported from user PDF / pasted program',
      metadata: { planPack: IMPORTED_NUTRITION_PLAN_PACK },
    })
    .select('id')
    .single();

  if (mealPlanError || !mealPlan) throw mealPlanError ?? new Error('Failed to create meal plan');

  let mealsInserted = 0;
  for (const day of plan.days) {
    const date = addDays(weekStart, day.dayIndex);
    for (let index = 0; index < day.meals.length; index += 1) {
      const meal = day.meals[index];
      const { error: mealError } = await db.from('meals').insert({
        user_id: userId,
        meal_plan_id: mealPlan.id,
        meal_type: meal.mealType,
        name: meal.name,
        scheduled_date: date,
        calories: meal.calories ?? null,
        protein_g: meal.proteinG ?? null,
        carbs_g: meal.carbsG ?? null,
        fat_g: meal.fatG ?? null,
        status: 'planned',
        origin: 'plan',
        macros_provided: meal.calories != null || meal.proteinG != null,
        client_key: mealClientKey(date, meal.mealType, meal.name, index),
        instructions: JSON.stringify({
          status: 'planned',
          scheduledTime: meal.scheduledTime ?? null,
          planPack: IMPORTED_NUTRITION_PLAN_PACK,
          notes: meal.notes ?? null,
        }),
      });
      if (mealError) throw mealError;
      mealsInserted += 1;
    }
  }

  return {
    planPack: IMPORTED_NUTRITION_PLAN_PACK,
    weekStart,
    mealsInserted,
    mealsCleared,
    goalsUpdated,
  };
}

/** Shape compatible with POST /api/nutrition/meal-plan/generate so the client insert path works. */
export function importedNutritionToMealPlanResponse(
  plan: ImportedNutritionPlan,
  weekStart: string,
): {
  name: string;
  weekStartDate: string;
  aiGenerated: boolean;
  aiRationale: string;
  meals: Array<{
    mealType: string;
    name: string;
    scheduledDate: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    instructions?: string;
  }>;
} {
  const meals: Array<{
    mealType: string;
    name: string;
    scheduledDate: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    instructions?: string;
  }> = [];

  for (const day of plan.days) {
    const scheduledDate = addDays(weekStart, day.dayIndex);
    for (const meal of day.meals) {
      meals.push({
        mealType: meal.mealType,
        name: meal.name,
        scheduledDate,
        calories: meal.calories ?? 0,
        proteinG: meal.proteinG ?? 0,
        carbsG: meal.carbsG ?? 0,
        fatG: meal.fatG ?? 0,
        instructions: JSON.stringify({
          scheduledTime: meal.scheduledTime ?? null,
          planPack: IMPORTED_NUTRITION_PLAN_PACK,
          notes: meal.notes ?? null,
        }),
      });
    }
  }

  return {
    name: plan.name ?? 'Imported Nutrition Plan',
    weekStartDate: weekStart,
    aiGenerated: false,
    aiRationale: 'Sticky imported nutrition plan from your PDF',
    meals,
  };
}

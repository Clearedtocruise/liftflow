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
import { addDays, weekStartFromDate } from './programTypes.js';
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

/**
 * Which plan day a calendar date eats from.
 *
 * A plan written as Monday–Sunday is a week and lines up with the calendar week. A plan written as
 * "Day 1 – Back + Rear Delts … Day 6 – Legs + Abs" follows the training days: Day 1 is the day the
 * plan starts and the days repeat from there. Laying those onto Monday + day number put a plan
 * imported on a Sunday onto the six days already gone, and left today with nothing to log.
 */
export type ImportedNutritionSchedule =
  | { mode: 'weekday' }
  | { mode: 'cycle'; startDate: string; startDayIndex: number; length: number };

const WEEKDAY_LABEL = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b/i;
const NUMBERED_DAY_LABEL = /^\s*day\s*\d+/i;
/** Days written past the end of the current window, so the next two weeks are there to log. */
const CYCLE_WINDOW_DAYS = 14;

export function importedNutritionSchedule(
  plan: ImportedNutritionPlan,
  today: string,
  startDay?: number | null,
): ImportedNutritionSchedule {
  const labels = plan.days.map((day) => day.label ?? '');
  const numbered = labels.some((label) => NUMBERED_DAY_LABEL.test(label));
  const weekdays = labels.some((label) => WEEKDAY_LABEL.test(label));
  if (plan.days.length === 0 || (!numbered && (weekdays || plan.days.length === DAYS_IN_WEEK))) {
    return { mode: 'weekday' };
  }
  const length = Math.max(...plan.days.map((day) => day.dayIndex)) + 1;
  const start = startDay != null && Number.isFinite(startDay) && startDay >= 1 ? Math.round(startDay) - 1 : 0;
  return { mode: 'cycle', startDate: today, startDayIndex: start % length, length };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** The plan day index for `date`, or null when the plan has not started by then. */
export function importedNutritionDayIndexForDate(schedule: ImportedNutritionSchedule, date: string): number | null {
  if (schedule.mode === 'weekday') return daysBetween(weekStartFromDate(date), date);
  const offset = daysBetween(schedule.startDate, date);
  if (offset < 0) return null;
  return (schedule.startDayIndex + offset) % schedule.length;
}

/** Each date in [from, to] paired with the plan day it eats from. */
export function importedNutritionDates(
  plan: ImportedNutritionPlan,
  schedule: ImportedNutritionSchedule,
  from: string,
  to: string,
): Array<{ date: string; day: ImportedNutritionDay }> {
  const out: Array<{ date: string; day: ImportedNutritionDay }> = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const index = importedNutritionDayIndexForDate(schedule, date);
    const day = index == null ? undefined : plan.days.find((candidate) => candidate.dayIndex === index);
    if (day) out.push({ date, day });
  }
  return out;
}

function storedSchedule(value: unknown): ImportedNutritionSchedule | null {
  const raw = value as Partial<{ mode: string; startDate: string; startDayIndex: number; length: number }> | null;
  if (raw?.mode === 'weekday') return { mode: 'weekday' };
  if (
    raw?.mode === 'cycle' &&
    typeof raw.startDate === 'string' &&
    Number.isInteger(raw.startDayIndex) &&
    Number.isInteger(raw.length) &&
    (raw.length as number) > 0
  ) {
    return { mode: 'cycle', startDate: raw.startDate, startDayIndex: raw.startDayIndex as number, length: raw.length as number };
  }
  return null;
}

export function mealClientKey(date: string, mealType: string, name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `import:${IMPORTED_NUTRITION_PLAN_PACK}:${date}:${mealType}:${slug}:${index}`;
}

export function describeDbError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const { message, code, details } = error as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [message, code ? `code ${String(code)}` : null, details].filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );
    if (parts.length > 0) return parts.join(' — ');
  }
  return 'unknown database error';
}

async function existingImportedMealKeys(
  db: ReturnType<typeof requireAdmin>,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from('meals')
    .select('client_key')
    .eq('user_id', userId)
    .like('client_key', `import:${IMPORTED_NUTRITION_PLAN_PACK}:%`);
  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as Array<{ client_key: string | null }>)
      .map((row) => row.client_key)
      .filter((key): key is string => typeof key === 'string'),
  );
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
  schedule?: ImportedNutritionSchedule,
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
          ...(schedule ? { schedule } : {}),
          savedAt: new Date().toISOString(),
        },
      },
    })
    .eq('id', userId);
}

export async function loadStoredImportedNutrition(
  userId: string,
): Promise<(ImportedNutritionPlan & { schedule: ImportedNutritionSchedule }) | null> {
  const db = requireAdmin();
  const { data: profile } = await db
    .from('profiles')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();
  const meta = (profile?.metadata ?? {}) as {
    coachProfile?: { nutritionPlanPack?: string };
    importedNutrition?: ImportedNutritionPlan & { planPack?: string; schedule?: unknown };
  };
  if (meta.coachProfile?.nutritionPlanPack !== IMPORTED_NUTRITION_PLAN_PACK) return null;
  const stored = meta.importedNutrition;
  if (!stored || !Array.isArray(stored.days)) return null;
  return {
    name: stored.name,
    goals: stored.goals,
    days: stored.days,
    // Saved before plans carried a schedule: they were always laid onto the calendar week.
    schedule: storedSchedule(stored.schedule) ?? { mode: 'weekday' },
  };
}

export async function applyImportedNutritionPlan(
  userId: string,
  rawPlan: ImportedNutritionPlan,
  options?: { persistBlueprint?: boolean; startDay?: number | null },
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
  const { today, weekStart, weekEnd } = cutPlanWeekWindow(
    new Date(),
    profile?.timezone as string | null | undefined,
  );
  const schedule = importedNutritionSchedule(plan, today, options?.startDay);
  const windowEnd = schedule.mode === 'cycle' ? addDays(today, CYCLE_WINDOW_DAYS - 1) : weekEnd;

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
    await storeImportedNutritionBlueprint(userId, plan, schedule);
  }

  const priorCleared = await clearPriorImportedMeals(db, userId);
  const weekCleared = await removePlannedMealsForWeek(db, userId, weekStart, windowEnd > weekEnd ? windowEnd : weekEnd);
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

  if (mealPlanError || !mealPlan) {
    throw new Error(`Could not create the meal plan: ${mealPlanError ? describeDbError(mealPlanError) : 'no row returned'}`);
  }

  const keptKeys = await existingImportedMealKeys(db, userId);

  let mealsInserted = 0;
  const from = schedule.mode === 'cycle' ? today : weekStart;
  for (const { date, day } of importedNutritionDates(plan, schedule, from, windowEnd)) {
    for (let index = 0; index < day.meals.length; index += 1) {
      const meal = day.meals[index];
      // A slot the lifter already logged, edited or swapped survives the clean-up above and still
      // owns its key. Writing the slot again collides with it on the unique index and used to fail
      // the whole import, so the slot they touched stands and the rest is filled in around it.
      if (keptKeys.has(mealClientKey(date, meal.mealType, meal.name, index))) continue;
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
      if (mealError) {
        // A plain object from the database client, not an Error: say what it was.
        throw new Error(`Could not save meal "${meal.name}" (${date}): ${describeDbError(mealError)}`);
      }
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
  schedule: ImportedNutritionSchedule = { mode: 'weekday' },
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

  for (const { date: scheduledDate, day } of importedNutritionDates(plan, schedule, weekStart, addDays(weekStart, 6))) {
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

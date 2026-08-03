import { api } from '@/api/client';
import { mapGroceryList, mapMeal, mapMealPlan, mapNutritionGoals } from '@/lib/db-mappers';
import { aggregateWeeklyGroceries } from '@/lib/groceryAggregation';
import { localDateString, resolveTimeZone } from '@/lib/localDate';
import { mealSlotKey, remapApiMealsToClientWeek, type ApiPlanMeal } from '@/lib/mealPlanWeekAlign';
import { aggregateDailyMeals, mealsForCalendarDay } from '@/lib/mealAggregation';
import { isReplaceablePlannedMeal, pickMealsToKeep, weekEndDate } from '@/lib/mealCleanup';
import { planDataCache } from '@/lib/planDataCache';
import { MEAL_NOT_FOUND } from '@/lib/mealErrors';
import { enrichMealMeta, correctedMacrosIfInflated, serializeMealMeta } from '@/lib/mealIngredients';
import { isInvertedBodyWeightKg, normalizeBodyWeightKg } from '@/lib/bodyWeightKg';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getWeekRange } from '@/lib/weekPlan';
import type { INutritionService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type { DailyNutritionSummary, GroceryList, Meal, MealStatus, MealType } from '@/types';

const MEAL_COLUMNS =
  'id, user_id, meal_plan_id, meal_type, name, scheduled_date, calories, protein_g, carbs_g, fat_g, instructions, status, origin, consumed_at, client_key, macros_provided, created_at';

function todayDate(): string {
  return localDateString();
}

function newClientKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeGroceryName(name: string): string {
  return name.trim().toLowerCase();
}

function weekStartDate(timeZone?: string | null): string {
  return getWeekRange(new Date(), resolveTimeZone(timeZone)).from;
}

/** Fix profiles.weight_kg when it looks like lbs×2.2 (~400 kg). Fire-and-forget safe. */
async function healInvertedProfileWeight(userId: string): Promise<void> {
  try {
    const { data } = await supabase.from('profiles').select('weight_kg').eq('id', userId).maybeSingle();
    const raw = data?.weight_kg != null ? Number(data.weight_kg) : null;
    if (!isInvertedBodyWeightKg(raw)) return;
    await supabase.from('profiles').update({ weight_kg: normalizeBodyWeightKg(raw) }).eq('id', userId);
  } catch {
    // Non-fatal — meal heal still runs.
  }
}

/**
 * Persist meal-sized macros for plan rows that still store the old ~11k-day
 * splits (e.g. Greek yogurt breakfast at 2827). Display-only correction is not
 * enough when the user regenerates against a backend that rewrites the same bug.
 */
async function persistHealedPlanMacros(meals: Meal[]): Promise<Meal[]> {
  const updates = meals.flatMap((meal) => {
    if (meal.origin !== 'plan') return [];
    if (meal.status !== 'planned' && meal.status !== 'skipped') return [];
    const corrected = correctedMacrosIfInflated(meal);
    if (!corrected) return [];
    return [{ meal, corrected }];
  });

  if (updates.length === 0) return meals;

  await Promise.all(
    updates.map(({ meal, corrected }) =>
      supabase
        .from('meals')
        .update({
          calories: corrected.calories,
          protein_g: corrected.proteinG,
          carbs_g: corrected.carbsG,
          fat_g: corrected.fatG,
          macros_provided: true,
        })
        .eq('id', meal.id),
    ),
  );

  const byId = new Map(updates.map(({ meal, corrected }) => [meal.id, corrected]));
  return meals.map((meal) => {
    const corrected = byId.get(meal.id);
    if (!corrected) return meal;
    return {
      ...meal,
      calories: corrected.calories,
      proteinG: corrected.proteinG,
      carbsG: corrected.carbsG,
      fatG: corrected.fatG,
      macrosProvided: true,
    };
  });
}

function sanitizePlanMealForInsert(meal: {
  name: string;
  mealType: MealType | string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}) {
  const corrected = correctedMacrosIfInflated({
    name: meal.name,
    mealType: meal.mealType,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    macrosProvided: true,
  });
  if (!corrected) return meal;
  return {
    ...meal,
    calories: corrected.calories,
    proteinG: corrected.proteinG,
    carbsG: corrected.carbsG,
    fatG: corrected.fatG,
  };
}

async function loadGroceryList(listId: string) {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*, grocery_list_items(*)')
    .eq('id', listId)
    .single();

  if (error) return fail<GroceryList>(error.message);
  return ok(mapGroceryList(data));
}

/** One list per user per week, so regenerating updates rows instead of piling up new lists. */
async function ensureWeeklyGroceryList(userId: string, weekStart: string, mealPlanId?: string) {
  const { data: existing } = await supabase
    .from('grocery_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .maybeSingle();

  if (existing?.id) {
    if (mealPlanId) await supabase.from('grocery_lists').update({ meal_plan_id: mealPlanId }).eq('id', existing.id);
    return ok(existing.id as string);
  }

  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({ user_id: userId, meal_plan_id: mealPlanId, name: 'Shopping List', week_start_date: weekStart })
    .select('id')
    .single();

  if (error) return fail<string>(error.message);
  return ok(data.id as string);
}

/**
 * Reconcile a list against freshly aggregated ingredients without wiping the
 * user's progress: matching rows are updated in place so `is_checked` survives,
 * and rows the user already checked are kept even if they left the plan.
 */
async function syncGroceryItems(
  listId: string,
  aggregated: { name: string; quantity: string; category: string }[],
): Promise<string | null> {
  const { data: existing, error } = await supabase
    .from('grocery_list_items')
    .select('id, name, is_checked')
    .eq('grocery_list_id', listId);

  if (error) return error.message;

  const byName = new Map((existing ?? []).map((row) => [normalizeGroceryName(row.name), row]));
  const desiredNames = new Set<string>();

  for (const [index, item] of aggregated.entries()) {
    const key = normalizeGroceryName(item.name);
    desiredNames.add(key);
    const fields = {
      name: item.name,
      quantity: parseFloat(item.quantity) || 1,
      unit: item.quantity.replace(/^[\d.]+\s*/, '') || 'serving',
      category: item.category,
      sort_order: index,
    };

    const match = byName.get(key);
    if (match) {
      const { error: updateError } = await supabase.from('grocery_list_items').update(fields).eq('id', match.id);
      if (updateError) return updateError.message;
      continue;
    }

    const { error: insertError } = await supabase
      .from('grocery_list_items')
      .insert({ grocery_list_id: listId, is_checked: false, ...fields });
    if (insertError) return insertError.message;
  }

  const staleIds = (existing ?? [])
    .filter((row) => !row.is_checked && !desiredNames.has(normalizeGroceryName(row.name)))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase.from('grocery_list_items').delete().in('id', staleIds);
    if (deleteError) return deleteError.message;
  }

  return null;
}

export const nutritionService: INutritionService = {
  async getGoals(userId) {
    try {
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail(error.message);
      if (!data) return ok(null);
      return ok(mapNutritionGoals(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async updateGoals(userId, goals) {
    try {
      await supabase.from('nutrition_goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

      const { data, error } = await supabase
        .from('nutrition_goals')
        .insert({
          user_id: userId,
          daily_calories: goals.dailyCalories,
          protein_g: goals.proteinG,
          carbs_g: goals.carbsG,
          fat_g: goals.fatG,
          water_ml: goals.waterMl,
          is_active: true,
          effective_from: todayDate(),
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapNutritionGoals(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async logFood(userId, food: { name: string; mealType: MealType; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; date?: string; instructions?: string; clientKey?: string; consumedAt?: string }) {
    try {
      const macrosProvided =
        food.calories != null || food.proteinG != null || food.carbsG != null || food.fatG != null;

      const { data, error } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          meal_type: food.mealType,
          name: food.name,
          scheduled_date: food.date ?? todayDate(),
          calories: food.calories,
          protein_g: food.proteinG,
          carbs_g: food.carbsG,
          fat_g: food.fatG,
          instructions: food.instructions,
          status: 'completed',
          origin: 'log',
          consumed_at: food.consumedAt ?? new Date().toISOString(),
          client_key: food.clientKey ?? newClientKey(),
          macros_provided: macrosProvided,
        })
        .select(MEAL_COLUMNS)
        .single();

      if (error) return fail(error.message);
      return ok(mapMeal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async ensureWeekMealCoverage(userId: string, timeZone?: string | null) {
    try {
      const { from, to, dates } = getWeekRange(new Date(), timeZone);
      const mealsResult = await this.getMealsForWeek(userId, from, to);
      if (!mealsResult.success) return fail(mealsResult.error);

      const missingDates = dates.filter(
        (date) => mealsForCalendarDay(mealsResult.data, date).length === 0,
      );
      if (missingDates.length === 0) return ok(0);

      const token = await getAccessToken();
      if (!token) return fail('Authentication required to sync meals');

      await api.syncNutritionDates({ userId, dates: missingDates }, token);
      return ok(missingDates.length);
    } catch (e) {
      return fromError(e);
    }
  },

  async getMealsForWeek(userId: string, from: string, to: string) {
    try {
      void healInvertedProfileWeight(userId);
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) return fail(error.message);
      const meals = await persistHealedPlanMacros((data ?? []).map(mapMeal));
      return ok(meals);
    } catch (e) {
      return fromError(e);
    }
  },

  async updateMeal(mealId: string, updates: Partial<Pick<Meal, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'instructions' | 'mealType' | 'status'>>) {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.calories !== undefined) payload.calories = updates.calories;
      if (updates.proteinG !== undefined) payload.protein_g = updates.proteinG;
      if (updates.carbsG !== undefined) payload.carbs_g = updates.carbsG;
      if (updates.fatG !== undefined) payload.fat_g = updates.fatG;
      if (updates.instructions !== undefined) payload.instructions = updates.instructions;
      if (updates.mealType !== undefined) payload.meal_type = updates.mealType;
      if (updates.status !== undefined) {
        payload.status = updates.status;
        // Ate confirmation stamps consumed_at; replace/skip clears it.
        if (updates.status === 'completed' || updates.status === 'modified') {
          payload.consumed_at = new Date().toISOString();
        } else if (updates.status === 'planned' || updates.status === 'skipped') {
          payload.consumed_at = null;
        }
      }
      if (updates.calories !== undefined || updates.proteinG !== undefined || updates.carbsG !== undefined || updates.fatG !== undefined) {
        payload.macros_provided = true;
      }

      // `.single()` turns "no such meal" into a raw PostgREST coercion error. Day sync and
      // duplicate pruning both delete and reinsert plan rows, so a screen can legitimately hold an
      // id that no longer exists — that is a refresh, not a database fault.
      const { data, error } = await supabase
        .from('meals')
        .update(payload)
        .eq('id', mealId)
        .select(MEAL_COLUMNS)
        .maybeSingle();
      if (error) return fail(error.message, error.code);
      if (!data) return fail('That meal no longer exists.', MEAL_NOT_FOUND);
      return ok(mapMeal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async markMealStatus(
    mealId: string,
    name: string,
    instructions: string | undefined,
    status: MealStatus,
    /** When the meal was actually eaten. Defaults to now for "just ate it". */
    consumedAt?: string,
  ) {
    try {
      const meta = enrichMealMeta(name, instructions);
      meta.status = status;
      const consumed = status === 'completed' || status === 'modified';

      const { data, error } = await supabase
        .from('meals')
        .update({
          status,
          consumed_at: consumed ? consumedAt ?? new Date().toISOString() : null,
          instructions: serializeMealMeta(meta),
        })
        .eq('id', mealId)
        .select(MEAL_COLUMNS)
        .maybeSingle();

      if (error) return fail(error.message, error.code);
      if (!data) return fail('That meal no longer exists.', MEAL_NOT_FOUND);
      return ok(mapMeal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async pruneDuplicateMeals(userId: string, range?: { from?: string; to?: string }) {
    try {
      let query = supabase
        .from('meals')
        .select(MEAL_COLUMNS)
        .eq('user_id', userId);

      if (range?.from) query = query.gte('scheduled_date', range.from);
      if (range?.to) query = query.lte('scheduled_date', range.to);

      const { data, error } = await query;
      if (error) return fail(error.message);

      const { removeIds } = pickMealsToKeep((data ?? []).map(mapMeal));
      if (removeIds.length === 0) return ok(0);

      const { error: deleteError } = await supabase.from('meals').delete().in('id', removeIds);
      if (deleteError) return fail(deleteError.message);
      return ok(removeIds.length);
    } catch (e) {
      return fromError(e);
    }
  },

  async removePlannedMealsForWeek(userId: string, weekStart: string) {
    try {
      const weekEnd = weekEndDate(weekStart);
      const { data, error } = await supabase
        .from('meals')
        .select(MEAL_COLUMNS)
        .eq('user_id', userId)
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd);

      if (error) return fail(error.message);

      const removeIds = (data ?? [])
        .map(mapMeal)
        .filter(isReplaceablePlannedMeal)
        .map((meal) => meal.id);

      if (removeIds.length === 0) return ok(0);

      const { error: deleteError } = await supabase.from('meals').delete().in('id', removeIds);
      if (deleteError) return fail(deleteError.message);
      return ok(removeIds.length);
    } catch (e) {
      return fromError(e);
    }
  },

  async getMealsForDate(userId, date: string) {
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', date)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);
      const meals = await persistHealedPlanMacros((data ?? []).map(mapMeal));
      return ok(meals);
    } catch (e) {
      return fromError(e);
    }
  },

  async getDailySummary(userId, date?: string) {
    try {
      const targetDate = date ?? todayDate();
      const [mealsResult, goalsResult, hydrationResult] = await Promise.all([
        supabase
          .from('meals')
          .select(MEAL_COLUMNS)
          .eq('user_id', userId)
          .eq('scheduled_date', targetDate),
        supabase.from('nutrition_goals').select('*').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
        supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('logged_at', `${targetDate}T00:00:00`).lte('logged_at', `${targetDate}T23:59:59`),
      ]);

      if (mealsResult.error) return fail(mealsResult.error.message);

      const meals = (mealsResult.data ?? []).map(mapMeal);
      const aggregated = aggregateDailyMeals(meals);
      const summary: DailyNutritionSummary = {
        date: targetDate,
        caloriesConsumed: aggregated.caloriesConsumed,
        caloriesTarget: goalsResult.data?.daily_calories ?? undefined,
        proteinG: aggregated.proteinG,
        proteinTargetG: goalsResult.data?.protein_g ?? undefined,
        carbsG: aggregated.carbsG,
        fatG: aggregated.fatG,
        waterMl: (hydrationResult.data ?? []).reduce((s, h) => s + h.amount_ml, 0),
        waterTargetMl: goalsResult.data?.water_ml ?? undefined,
      };

      return ok(summary);
    } catch (e) {
      return fromError(e);
    }
  },

  async getMealPlans(userId) {
    try {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*, meals(*)')
        .eq('user_id', userId)
        .order('week_start_date', { ascending: false });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapMealPlan));
    } catch (e) {
      return fromError(e);
    }
  },

  async generateWeeklyMealPlan(userId, timeZone?: string | null, prefs?: { dietaryStyle?: string; dietaryRestrictions?: string[]; foodPreferences?: string[] }) {
    try {
      await healInvertedProfileWeight(userId);
      const tz = resolveTimeZone(timeZone);
      const token = await getAccessToken();
      const plan = await api.generateMealPlan({ userId, ...prefs }, token);
      const clientWeekStart = weekStartDate(tz);
      const clientWeekEnd = weekEndDate(clientWeekStart);
      const apiWeekStart = plan.weekStartDate ?? clientWeekStart;

      const { data: existingMeals } = await supabase
        .from('meals')
        .select(MEAL_COLUMNS)
        .eq('user_id', userId)
        .gte('scheduled_date', clientWeekStart)
        .lte('scheduled_date', clientWeekEnd);

      const existing = (existingMeals ?? []).map(mapMeal);

      /**
       * The meals this plan would replace, identified now but not deleted until the new week is
       * safely saved. This used to delete first, and every failure after that point — an empty
       * response from the API, a rejected insert, a dropped connection — returned an error with
       * the week's meals already gone and nothing to restore them.
       */
      const staleMealIds = existing.filter(isReplaceablePlannedMeal).map((meal) => meal.id);

      // Only meals that are being kept can block a slot; the replaceable ones are on their way out.
      const occupiedSlots = new Set(
        existing
          .filter((meal) => meal.scheduledDate != null && !isReplaceablePlannedMeal(meal))
          .map((meal) => mealSlotKey(meal.scheduledDate as string, meal.mealType)),
      );

      const apiMeals = (plan.meals ?? []) as ApiPlanMeal[];
      if (apiMeals.length === 0) {
        return fail('Meal plan API returned no meals.');
      }

      const alignedMeals = remapApiMealsToClientWeek(apiMeals, apiWeekStart, clientWeekStart);
      const mealsToInsert = alignedMeals
        .filter((meal) => !occupiedSlots.has(mealSlotKey(meal.scheduledDate, meal.mealType)))
        .map((meal) => sanitizePlanMealForInsert(meal));

      if (mealsToInsert.length === 0) {
        return fail('Could not add meals — existing logged meals may be blocking this week.');
      }

      const { data: saved, error } = await supabase
        .from('meal_plans')
        .insert({
          user_id: userId,
          name: plan.name ?? 'Weekly Plan',
          week_start_date: clientWeekStart,
          ai_generated: true,
          ai_rationale: plan.aiRationale,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      const { data: inserted, error: insertError } = await supabase
        .from('meals')
        .insert(
          mealsToInsert.map((m) => ({
            meal_plan_id: saved.id,
            user_id: userId,
            meal_type: m.mealType,
            name: m.name,
            scheduled_date: m.scheduledDate.slice(0, 10),
            calories: m.calories,
            protein_g: m.proteinG,
            carbs_g: m.carbsG,
            fat_g: m.fatG,
            instructions: m.instructions ?? serializeMealMeta(enrichMealMeta(m.name)),
            status: 'planned',
            origin: 'plan',
            macros_provided: true,
          })),
        )
        .select(MEAL_COLUMNS);

      if (insertError) {
        await supabase.from('meal_plans').delete().eq('id', saved.id);
        return fail(insertError.message);
      }

      if (!inserted || inserted.length === 0) {
        await supabase.from('meal_plans').delete().eq('id', saved.id);
        return fail('Meals could not be saved to your account.');
      }

      // The new week exists, so the meals it replaces can go.
      if (staleMealIds.length > 0) {
        await supabase.from('meals').delete().in('id', staleMealIds);
      }
      await this.pruneDuplicateMeals(userId, { from: clientWeekStart, to: clientWeekEnd });

      const weekMeals = await this.getMealsForWeek(userId, clientWeekStart, clientWeekEnd);
      if (!weekMeals.success || weekMeals.data.length === 0) {
        return fail('Meals saved but could not be loaded — pull to refresh.');
      }

      return ok({
        ...mapMealPlan({ ...saved, meals: inserted }),
        meals: weekMeals.data,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async generateGroceryList(userId, mealPlanId?: string) {
    try {
      const { from, to } = getWeekRange(new Date(), undefined);
      const mealsResult = await this.getMealsForWeek(userId, from, to);
      if (!mealsResult.success) return fail(mealsResult.error);

      let planId = mealPlanId;
      if (!planId) {
        const { data: latest } = await supabase
          .from('meal_plans')
          .select('id')
          .eq('user_id', userId)
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        planId = latest?.id;
      }

      const listResult = await ensureWeeklyGroceryList(userId, weekStartDate(), planId);
      if (!listResult.success) return listResult;

      const syncError = await syncGroceryItems(listResult.data, aggregateWeeklyGroceries(mealsResult.data));
      if (syncError) return fail(syncError);

      return loadGroceryList(listResult.data);
    } catch (e) {
      return fromError(e);
    }
  },

  async setGroceryItemChecked(itemId: string, isChecked: boolean) {
    try {
      const { error } = await supabase.from('grocery_list_items').update({ is_checked: isChecked }).eq('id', itemId);
      if (error) return fail(error.message);
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async addGroceryItem(listId: string, item: { name: string; quantity?: number; unit?: string; category?: string }) {
    try {
      const name = item.name.trim();
      if (!name) return fail('Item name is required.');

      const { data: existing } = await supabase
        .from('grocery_list_items')
        .select('id, name')
        .eq('grocery_list_id', listId);

      const match = (existing ?? []).find((row) => normalizeGroceryName(row.name) === normalizeGroceryName(name));
      if (match) return loadGroceryList(listId);

      const { error } = await supabase.from('grocery_list_items').insert({
        grocery_list_id: listId,
        name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'serving',
        category: item.category ?? 'other',
        is_checked: false,
        sort_order: (existing ?? []).length,
      });

      if (error) return fail(error.message);
      return loadGroceryList(listId);
    } catch (e) {
      return fromError(e);
    }
  },

  async getGroceryLists(userId) {
    try {
      const { data, error } = await supabase
        .from('grocery_lists')
        .select('*, grocery_list_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapGroceryList));
    } catch (e) {
      return fromError(e);
    }
  },

  async logHydration(userId, amountMl) {
    try {
      const { data, error } = await supabase
        .from('hydration_logs')
        .insert({ user_id: userId, amount_ml: amountMl, logged_at: new Date().toISOString() })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        loggedAt: data.logged_at,
        amountMl: data.amount_ml,
        source: data.source,
        createdAt: data.logged_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async getAdaptiveTargets(userId: string) {
    try {
      const token = await getAccessToken();
      const targets = await api.getAdaptiveMacroTargets(userId, token);
      return ok(targets);
    } catch (e) {
      return fromError(e);
    }
  },

  /**
   * Recompute macro targets from the current training goal and save them.
   *
   * Changing a goal previously updated the profile only, leaving the active `nutrition_goals` row —
   * and the cached copy the Nutrition tab paints first — describing the goal the user just left.
   */
  async recalculateGoals(userId: string) {
    try {
      const token = await getAccessToken();
      const targets = await api.recalculateNutritionGoals(userId, token);

      const refreshed = await nutritionService.getGoals(userId);
      if (refreshed.success && refreshed.data) {
        await planDataCache.writeGoals(userId, refreshed.data);
      }

      return ok(targets);
    } catch (e) {
      return fromError(e);
    }
  },

  async generateDailyPlan(userId: string, dietaryStyle?: string) {
    try {
      const token = await getAccessToken();
      const plan = await api.generateDailyMealPlan({ userId, dietaryStyle }, token);
      return ok(plan);
    } catch (e) {
      return fromError(e);
    }
  },

  async getRecommendations(userId) {
    try {
      const { data, error } = await supabase
        .from('nutrition_recommendations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          title: row.title,
          description: row.description,
          rationale: row.rationale ?? undefined,
          evidenceCitations: row.evidence_citations ?? [],
          payload: row.payload ?? {},
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async syncGroceryListFromMeals(userId: string, from: string, to: string) {
    try {
      const listsResult = await this.getGroceryLists(userId);
      if (!listsResult.success || !listsResult.data?.length) return ok(null);

      const list = listsResult.data[0];
      const mealsResult = await this.getMealsForWeek(userId, from, to);
      if (!mealsResult.success) return fail(mealsResult.error);

      const syncError = await syncGroceryItems(list.id, aggregateWeeklyGroceries(mealsResult.data));
      if (syncError) return fail(syncError);

      return loadGroceryList(list.id);
    } catch (e) {
      return fromError(e);
    }
  },
};

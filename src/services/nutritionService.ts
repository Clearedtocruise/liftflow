import { api } from '@/api/client';
import { mapGroceryList, mapMeal, mapMealPlan, mapNutritionGoals } from '@/lib/db-mappers';
import { aggregateWeeklyGroceries } from '@/lib/groceryAggregation';
import { aggregateDailyMeals } from '@/lib/mealAggregation';
import { isReplaceablePlannedMeal, pickMealsToKeep, weekEndDate } from '@/lib/mealCleanup';
import { enrichMealMeta, serializeMealMeta } from '@/lib/mealIngredients';
import { localDateString } from '@/lib/localDate';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getWeekRange } from '@/lib/weekPlan';
import type { INutritionService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type { DailyNutritionSummary, Meal, MealType } from '@/types';

function todayDate(): string {
  return localDateString();
}

function weekStartDate(): string {
  return getWeekRange().from;
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

  async logFood(userId, food: { name: string; mealType: MealType; calories?: number; proteinG?: number; carbsG?: number; fatG?: number; date?: string; instructions?: string }) {
    try {
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
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapMeal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async getMealsForWeek(userId: string, from: string, to: string) {
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapMeal));
    } catch (e) {
      return fromError(e);
    }
  },

  async updateMeal(mealId: string, updates: Partial<Pick<Meal, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'instructions' | 'mealType'>>) {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.calories !== undefined) payload.calories = updates.calories;
      if (updates.proteinG !== undefined) payload.protein_g = updates.proteinG;
      if (updates.carbsG !== undefined) payload.carbs_g = updates.carbsG;
      if (updates.fatG !== undefined) payload.fat_g = updates.fatG;
      if (updates.instructions !== undefined) payload.instructions = updates.instructions;
      if (updates.mealType !== undefined) payload.meal_type = updates.mealType;

      const { data, error } = await supabase.from('meals').update(payload).eq('id', mealId).select('*').single();
      if (error) return fail(error.message);
      return ok(mapMeal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async markMealStatus(mealId: string, name: string, instructions: string | undefined, status: 'completed' | 'skipped' | 'modified' | 'planned') {
    const meta = enrichMealMeta(name, instructions);
    meta.status = status;
    return this.updateMeal(mealId, { instructions: serializeMealMeta(meta) });
  },

  async pruneDuplicateMeals(userId: string, range?: { from?: string; to?: string }) {
    try {
      let query = supabase
        .from('meals')
        .select('id, user_id, meal_type, meal_plan_id, name, scheduled_date, calories, protein_g, carbs_g, fat_g, instructions, created_at')
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
        .select('id, user_id, meal_type, meal_plan_id, name, scheduled_date, calories, protein_g, carbs_g, fat_g, instructions, created_at')
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
      return ok((data ?? []).map(mapMeal));
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
          .select('id, user_id, meal_type, meal_plan_id, name, calories, protein_g, carbs_g, fat_g, instructions, created_at')
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

  async generateWeeklyMealPlan(userId) {
    try {
      const token = await getAccessToken();
      const plan = await api.generateMealPlan(userId, token);
      const weekStart = plan.weekStartDate ?? weekStartDate();
      const weekEnd = weekEndDate(weekStart);

      await this.pruneDuplicateMeals(userId);
      await this.removePlannedMealsForWeek(userId, weekStart);

      const { data: existingMeals } = await supabase
        .from('meals')
        .select('id, user_id, meal_type, meal_plan_id, name, scheduled_date, calories, protein_g, carbs_g, fat_g, instructions, created_at')
        .eq('user_id', userId)
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd);

      const occupiedSlots = new Set(
        (existingMeals ?? [])
          .map(mapMeal)
          .filter((meal) => !isReplaceablePlannedMeal(meal))
          .map((meal) => `${meal.scheduledDate}:${meal.mealType}`),
      );

      const { data: saved, error } = await supabase
        .from('meal_plans')
        .insert({
          user_id: userId,
          name: plan.name ?? 'Weekly Plan',
          week_start_date: plan.weekStartDate ?? weekStartDate(),
          ai_generated: true,
          ai_rationale: plan.aiRationale,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      const meals: Meal[] = plan.meals ?? [];
      const mealsToInsert = meals.filter((meal) => !occupiedSlots.has(`${meal.scheduledDate}:${meal.mealType}`));

      if (mealsToInsert.length > 0) {
        await supabase.from('meals').insert(
          mealsToInsert.map((m) => ({
            meal_plan_id: saved.id,
            user_id: userId,
            meal_type: m.mealType,
            name: m.name,
            scheduled_date: m.scheduledDate,
            calories: m.calories,
            protein_g: m.proteinG,
            carbs_g: m.carbsG,
            fat_g: m.fatG,
            instructions: m.instructions ?? serializeMealMeta(enrichMealMeta(m.name)),
          })),
        );
      }

      const { data: full } = await supabase
        .from('meal_plans')
        .select('*, meals(*)')
        .eq('id', saved.id)
        .single();

      return ok(mapMealPlan(full!));
    } catch (e) {
      return fromError(e);
    }
  },

  async generateGroceryList(userId, mealPlanId?: string) {
    try {
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

      const { data: mealsData } = planId
        ? await supabase.from('meals').select('*').eq('meal_plan_id', planId)
        : await supabase.from('meals').select('*').eq('user_id', userId).gte('scheduled_date', weekStartDate());

      const meals = (mealsData ?? []).map(mapMeal);
      const aggregated = aggregateWeeklyGroceries(meals);

      const { data: list, error } = await supabase
        .from('grocery_lists')
        .insert({
          user_id: userId,
          meal_plan_id: planId,
          name: 'Shopping List',
          week_start_date: weekStartDate(),
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      const items = aggregated.map((item, index) => ({
        grocery_list_id: list.id,
        name: item.name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.quantity.replace(/^[\d.]+\s*/, '') || 'serving',
        category: item.category,
        sort_order: index,
      }));

      if (items.length > 0) {
        await supabase.from('grocery_list_items').insert(items);
      }

      const { data: full } = await supabase
        .from('grocery_lists')
        .select('*, grocery_list_items(*)')
        .eq('id', list.id)
        .single();

      return ok(mapGroceryList(full!));
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

      const aggregated = aggregateWeeklyGroceries(mealsResult.data);
      await supabase.from('grocery_list_items').delete().eq('grocery_list_id', list.id);

      const items = aggregated.map((item, index) => ({
        grocery_list_id: list.id,
        name: item.name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.quantity.replace(/^[\d.]+\s*/, '') || 'serving',
        category: item.category,
        sort_order: index,
      }));

      if (items.length > 0) {
        await supabase.from('grocery_list_items').insert(items);
      }

      const { data: full, error } = await supabase
        .from('grocery_lists')
        .select('*, grocery_list_items(*)')
        .eq('id', list.id)
        .single();

      if (error) return fail(error.message);
      return ok(mapGroceryList(full!));
    } catch (e) {
      return fromError(e);
    }
  },
};

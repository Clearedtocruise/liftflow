import { mapGroceryList, mapMeal } from '@/lib/db-mappers';
import { aggregateWeeklyGroceries } from '@/lib/groceryAggregation';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { supabase } from '@/supabase/client';
import type { GroceryList, Meal } from '@/types';
import type { ServiceResult } from '@/types/common';

type ExistingGroceryItemRow = {
  id: string;
  name: string;
  unit: string | null;
  is_checked: boolean;
};

function normalizedItemKey(name: string, unit?: string | null): string {
  return `${name.trim().toLowerCase()}|${(unit ?? '').trim().toLowerCase()}`;
}

/** Splits a formatted "10.5 oz" style quantity string back into amount + unit. */
function splitQuantity(quantity: string): { amount: number; unit: string } {
  const match = quantity.trim().match(/^(-?[\d.]+)\s*(.*)$/);
  if (!match) return { amount: 1, unit: quantity.trim() || 'serving' };

  const amount = Number(match[1]);
  return {
    amount: Number.isFinite(amount) ? amount : 1,
    unit: match[2].trim() || 'serving',
  };
}

async function fetchMealsForWeek(userId: string, from: string, to: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMeal);
}

/** Prefer the plan for this exact week, then fall back to the most recent plan. */
async function resolveMealPlanId(userId: string, from: string, explicitMealPlanId?: string): Promise<string | undefined> {
  if (explicitMealPlanId) return explicitMealPlanId;

  const { data: matchingWeek } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', from)
    .maybeSingle();
  if (matchingWeek) return matchingWeek.id;

  const { data: latest } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest?.id ?? undefined;
}

async function loadListWithItems(listId: string): Promise<ServiceResult<GroceryList>> {
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*, grocery_list_items(*)')
    .eq('id', listId)
    .single();

  if (error) return fail(error.message);
  return ok(mapGroceryList(data));
}

export const groceryService = {
  /**
   * Ensures a single grocery list exists for the given week (creating it if
   * missing) and re-syncs its items from the week's meals — merging
   * duplicate ingredients, scaling by servings, and preserving `is_checked`
   * for items that persist across syncs (matched by normalized name + unit).
   */
  async upsertWeekList(userId: string, from: string, to: string, mealPlanId?: string): Promise<ServiceResult<GroceryList>> {
    try {
      const meals = await fetchMealsForWeek(userId, from, to);
      const aggregated = aggregateWeeklyGroceries(meals);

      const { data: existingList, error: findError } = await supabase
        .from('grocery_lists')
        .select('*, grocery_list_items(*)')
        .eq('user_id', userId)
        .eq('week_start_date', from)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) return fail(findError.message);

      let listId: string = existingList?.id;
      if (!listId) {
        const planId = await resolveMealPlanId(userId, from, mealPlanId);
        const { data: created, error: createError } = await supabase
          .from('grocery_lists')
          .insert({
            user_id: userId,
            meal_plan_id: planId,
            name: 'Shopping List',
            week_start_date: from,
          })
          .select('*')
          .single();

        if (createError) return fail(createError.message);
        listId = created.id;
      }

      const existingItems: ExistingGroceryItemRow[] = existingList?.grocery_list_items ?? [];
      const existingByKey = new Map(existingItems.map((item) => [normalizedItemKey(item.name, item.unit), item]));

      const nextItems = aggregated.map((item, index) => {
        const { amount, unit } = splitQuantity(item.quantity);
        const match = existingByKey.get(normalizedItemKey(item.name, unit));
        return {
          id: match?.id,
          grocery_list_id: listId,
          name: item.name,
          quantity: amount,
          unit,
          category: item.category,
          is_checked: match?.is_checked ?? false,
          sort_order: index,
        };
      });

      const keptKeys = new Set(nextItems.map((item) => normalizedItemKey(item.name, item.unit)));
      const staleIds = existingItems
        .filter((item) => !keptKeys.has(normalizedItemKey(item.name, item.unit)))
        .map((item) => item.id);

      if (staleIds.length > 0) {
        const { error: deleteError } = await supabase.from('grocery_list_items').delete().in('id', staleIds);
        if (deleteError) return fail(deleteError.message);
      }

      const toInsert = nextItems.filter((item) => !item.id).map(({ id: _unused, ...rest }) => rest);
      const toUpdate = nextItems.filter((item): item is typeof item & { id: string } => Boolean(item.id));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('grocery_list_items').insert(toInsert);
        if (insertError) return fail(insertError.message);
      }

      if (toUpdate.length > 0) {
        const updateResults = await Promise.all(
          toUpdate.map((item) =>
            supabase
              .from('grocery_list_items')
              .update({
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                sort_order: item.sort_order,
              })
              .eq('id', item.id),
          ),
        );
        const updateError = updateResults.find((result) => result.error)?.error;
        if (updateError) return fail(updateError.message);
      }

      return loadListWithItems(listId);
    } catch (e) {
      return fromError(e);
    }
  },

  async toggleItem(itemId: string, isChecked: boolean): Promise<ServiceResult<GroceryList>> {
    try {
      const { data, error } = await supabase
        .from('grocery_list_items')
        .update({ is_checked: isChecked })
        .eq('id', itemId)
        .select('grocery_list_id')
        .single();

      if (error) return fail(error.message);
      return loadListWithItems(data.grocery_list_id);
    } catch (e) {
      return fromError(e);
    }
  },

  async updateItemQuantity(
    itemId: string,
    quantity: number,
    unit?: string,
    extras?: { name?: string; category?: string },
  ): Promise<ServiceResult<GroceryList>> {
    try {
      const payload: Record<string, unknown> = { quantity };
      if (unit !== undefined) payload.unit = unit;
      if (extras?.name !== undefined) payload.name = extras.name;
      if (extras?.category !== undefined) payload.category = extras.category;

      const { data, error } = await supabase
        .from('grocery_list_items')
        .update(payload)
        .eq('id', itemId)
        .select('grocery_list_id')
        .single();

      if (error) return fail(error.message);
      return loadListWithItems(data.grocery_list_id);
    } catch (e) {
      return fromError(e);
    }
  },

  async addManualItem(
    listId: string,
    item: { name: string; quantity?: number; unit?: string; category?: string },
  ): Promise<ServiceResult<GroceryList>> {
    try {
      const { data: lastItem, error: findError } = await supabase
        .from('grocery_list_items')
        .select('sort_order')
        .eq('grocery_list_id', listId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) return fail(findError.message);

      const { error: insertError } = await supabase.from('grocery_list_items').insert({
        grocery_list_id: listId,
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'serving',
        category: item.category ?? 'Miscellaneous',
        is_checked: false,
        sort_order: (lastItem?.sort_order ?? -1) + 1,
      });

      if (insertError) return fail(insertError.message);
      return loadListWithItems(listId);
    } catch (e) {
      return fromError(e);
    }
  },

  async deleteItem(itemId: string): Promise<ServiceResult<GroceryList>> {
    try {
      const { data: existing, error: findError } = await supabase
        .from('grocery_list_items')
        .select('grocery_list_id')
        .eq('id', itemId)
        .single();

      if (findError) return fail(findError.message);

      const { error: deleteError } = await supabase.from('grocery_list_items').delete().eq('id', itemId);
      if (deleteError) return fail(deleteError.message);

      return loadListWithItems(existing.grocery_list_id);
    } catch (e) {
      return fromError(e);
    }
  },
};

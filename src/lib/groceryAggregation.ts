import { enrichMealMeta } from '@/lib/mealIngredients';
import type { Meal } from '@/types';

export type AggregatedGroceryItem = {
  name: string;
  quantity: string;
  category: string;
};

function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase();
}

function parseServingAmount(serving: string): { value: number; unit: string } {
  const match = serving.match(/([\d.]+)\s*(.*)/);
  if (!match) return { value: 1, unit: serving.trim() || 'serving' };
  return { value: Number(match[1]) || 1, unit: match[2].trim() || 'serving' };
}

export function aggregateWeeklyGroceries(meals: Meal[]): AggregatedGroceryItem[] {
  const totals = new Map<string, { value: number; unit: string; category: string }>();

  for (const meal of meals) {
    const meta = enrichMealMeta(meal.name, meal.instructions);
    for (const ingredient of meta.ingredients ?? []) {
      const key = normalizeIngredient(ingredient.name);
      const parsed = parseServingAmount(ingredient.serving);
      const existing = totals.get(key);
      if (!existing) {
        totals.set(key, {
          value: parsed.value,
          unit: parsed.unit,
          category: categorizeIngredient(ingredient.name),
        });
        continue;
      }
      if (existing.unit === parsed.unit) {
        existing.value += parsed.value;
      } else {
        existing.value += 1;
        existing.unit = `${existing.value} servings`;
      }
    }
  }

  return Array.from(totals.entries())
    .map(([name, data]) => ({
      name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
      quantity: `${Math.round(data.value * 10) / 10} ${data.unit}`.trim(),
      category: data.category,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('chicken') || lower.includes('turkey') || lower.includes('beef') || lower.includes('fish') || lower.includes('salmon') || lower.includes('protein') || lower.includes('egg') || lower.includes('yogurt')) {
    return 'Protein';
  }
  if (lower.includes('rice') || lower.includes('oats') || lower.includes('bread') || lower.includes('banana') || lower.includes('berry') || lower.includes('fruit') || lower.includes('potato') || lower.includes('quinoa')) {
    return 'Carbs';
  }
  if (lower.includes('oil') || lower.includes('nut') || lower.includes('avocado')) {
    return 'Fats';
  }
  if (lower.includes('broccoli') || lower.includes('spinach') || lower.includes('vegetable') || lower.includes('salad')) {
    return 'Produce';
  }
  return 'Pantry';
}

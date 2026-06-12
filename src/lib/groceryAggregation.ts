import { enrichMealMeta } from '@/lib/mealIngredients';
import type { Meal } from '@/types';

export type AggregatedGroceryItem = {
  name: string;
  quantity: string;
  category: string;
};

const UNIT_ALIASES: Record<string, string> = {
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  cup: 'cup',
  cups: 'cup',
  scoop: 'scoop',
  scoops: 'scoop',
  medium: 'medium',
  mediums: 'medium',
  slice: 'slice',
  slices: 'slice',
  large: 'large',
  wedge: 'wedge',
  serving: 'serving',
  servings: 'serving',
};

function normalizeIngredient(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase();
  return UNIT_ALIASES[trimmed] ?? trimmed;
}

function parseNumeric(value: string): number {
  if (value.includes('/')) {
    const [num, den] = value.split('/');
    return Number(num) / Number(den || 1);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function parseServingAmount(serving: string): { value: number; unit: string } {
  const match = serving.match(/^([\d./]+)\s*(.*)$/);
  if (!match) return { value: 1, unit: normalizeUnit(serving.trim() || 'serving') };

  return {
    value: parseNumeric(match[1]),
    unit: normalizeUnit(match[2].trim() || 'serving'),
  };
}

function formatQuantity(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${unit}`.trim();
}

export function aggregateWeeklyGroceries(meals: Meal[]): AggregatedGroceryItem[] {
  const totals = new Map<string, { value: number; unit: string; category: string; displayName: string }>();

  for (const meal of meals) {
    const meta = enrichMealMeta(meal.name, meal.instructions);
    for (const ingredient of meta.ingredients ?? []) {
      const parsed = parseServingAmount(ingredient.serving);
      const unit = parsed.unit;
      const key = `${normalizeIngredient(ingredient.name)}|${unit}`;
      const existing = totals.get(key);
      if (!existing) {
        totals.set(key, {
          value: parsed.value,
          unit,
          category: categorizeIngredient(ingredient.name),
          displayName: ingredient.name.trim(),
        });
        continue;
      }
      existing.value += parsed.value;
    }
  }

  return Array.from(totals.values())
    .map((data) => ({
      name: data.displayName,
      quantity: formatQuantity(data.value, data.unit),
      category: data.category,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('chicken') ||
    lower.includes('turkey') ||
    lower.includes('beef') ||
    lower.includes('fish') ||
    lower.includes('salmon') ||
    lower.includes('protein') ||
    lower.includes('egg') ||
    lower.includes('yogurt') ||
    lower.includes('tofu') ||
    lower.includes('cod')
  ) {
    return 'Protein';
  }
  if (
    lower.includes('rice') ||
    lower.includes('oats') ||
    lower.includes('bread') ||
    lower.includes('banana') ||
    lower.includes('berry') ||
    lower.includes('fruit') ||
    lower.includes('potato') ||
    lower.includes('quinoa') ||
    lower.includes('wrap')
  ) {
    return 'Carbs';
  }
  if (lower.includes('oil') || lower.includes('nut') || lower.includes('avocado') || lower.includes('butter')) {
    return 'Fats';
  }
  if (
    lower.includes('broccoli') ||
    lower.includes('spinach') ||
    lower.includes('vegetable') ||
    lower.includes('salad') ||
    lower.includes('pepper') ||
    lower.includes('asparagus')
  ) {
    return 'Produce';
  }
  return 'Pantry';
}

export function groupGroceriesByCategory(items: AggregatedGroceryItem[]): Record<string, AggregatedGroceryItem[]> {
  return items.reduce<Record<string, AggregatedGroceryItem[]>>((groups, item) => {
    const bucket = groups[item.category] ?? [];
    bucket.push(item);
    groups[item.category] = bucket;
    return groups;
  }, {});
}

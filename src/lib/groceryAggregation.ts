import { enrichMealMeta } from '@/lib/mealIngredients';
import type { Meal } from '@/types';

export type AggregatedGroceryItem = {
  name: string;
  quantity: string;
  category: string;
};

/** Canonical shopping order — matches a typical grocery store walk. */
export const GROCERY_AISLE_ORDER = [
  'Produce',
  'Meat',
  'Dairy',
  'Frozen',
  'Pantry',
  'Spices',
  'Beverages',
  'Miscellaneous',
] as const;

export type GroceryAisle = (typeof GROCERY_AISLE_ORDER)[number];

const AISLE_RANK = new Map<string, number>(GROCERY_AISLE_ORDER.map((aisle, index) => [aisle, index]));

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

function mealServings(meal: Meal): number {
  const raw = meal.servings;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function aggregateWeeklyGroceries(meals: Meal[]): AggregatedGroceryItem[] {
  const totals = new Map<string, { value: number; unit: string; category: string; displayName: string }>();

  for (const meal of meals) {
    const meta = enrichMealMeta(meal.name, meal.instructions);
    const servings = mealServings(meal);
    for (const ingredient of meta.ingredients ?? []) {
      const parsed = parseServingAmount(ingredient.serving);
      const unit = parsed.unit;
      const key = `${normalizeIngredient(ingredient.name)}|${unit}`;
      const scaledValue = parsed.value * servings;
      const existing = totals.get(key);
      if (!existing) {
        totals.set(key, {
          value: scaledValue,
          unit,
          category: categorizeIngredient(ingredient.name),
          displayName: ingredient.name.trim(),
        });
        continue;
      }
      existing.value += scaledValue;
    }
  }

  return Array.from(totals.values())
    .map((data) => ({
      name: data.displayName,
      quantity: formatQuantity(data.value, data.unit),
      category: data.category,
    }))
    .sort((a, b) => {
      const rankDiff = (AISLE_RANK.get(a.category) ?? GROCERY_AISLE_ORDER.length) -
        (AISLE_RANK.get(b.category) ?? GROCERY_AISLE_ORDER.length);
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
    });
}

const FROZEN_KEYWORDS = ['frozen', 'ice cream', 'popsicle'];
const NUT_BUTTER_KEYWORDS = ['almond butter', 'peanut butter', 'cashew butter', 'sunflower butter', 'nut butter'];
const BEVERAGE_KEYWORDS = [
  'juice', 'soda', 'coffee', 'tea', 'almond milk', 'soy milk', 'oat milk',
  'coconut milk', 'protein shake', 'kombucha', 'sports drink', 'lemonade',
];
const DAIRY_KEYWORDS = ['yogurt', 'cheese', 'milk', 'egg', 'cream', 'butter'];
const MEAT_KEYWORDS = [
  'chicken', 'turkey', 'beef', 'pork', 'steak', 'bacon', 'sausage', 'fish',
  'salmon', 'cod', 'tilapia', 'shrimp', 'meatball', 'tofu', 'edamame',
];
const PRODUCE_KEYWORDS = [
  'banana', 'berry', 'berries', 'apple', 'spinach', 'broccoli', 'vegetable',
  'salad', 'pepper', 'asparagus', 'potato', 'lettuce', 'tomato', 'onion',
  'garlic', 'lemon', 'lime', 'avocado', 'cucumber', 'carrot', 'zucchini',
  'mushroom', 'greens', 'fruit', 'kale', 'green bean',
];
const SPICE_KEYWORDS = [
  'salt', 'cinnamon', 'cumin', 'paprika', 'oregano', 'basil', 'spice',
  'seasoning', 'herb', 'chili powder', 'garlic powder', 'onion powder',
  'black pepper', 'cayenne',
];
const MISC_KEYWORDS = ['protein powder', 'whey', 'supplement', 'creatine', 'multivitamin'];
const PANTRY_KEYWORDS = [
  'rice', 'oats', 'bread', 'wrap', 'quinoa', 'pasta', 'noodle', 'flour',
  'sugar', 'honey', 'oil', 'nut', 'granola', 'cereal', 'marinara', 'sauce',
  'canned', 'bean', 'lentil', 'tortilla', 'mustard', 'balsamic', 'vinegar',
];

function includesAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function categorizeIngredient(name: string): GroceryAisle {
  const lower = name.toLowerCase();

  if (includesAny(lower, FROZEN_KEYWORDS)) return 'Frozen';
  if (includesAny(lower, NUT_BUTTER_KEYWORDS)) return 'Pantry';
  if (includesAny(lower, BEVERAGE_KEYWORDS)) return 'Beverages';
  if (includesAny(lower, DAIRY_KEYWORDS)) return 'Dairy';
  if (includesAny(lower, MEAT_KEYWORDS)) return 'Meat';
  if (includesAny(lower, PRODUCE_KEYWORDS)) return 'Produce';
  if (includesAny(lower, SPICE_KEYWORDS)) return 'Spices';
  if (includesAny(lower, MISC_KEYWORDS)) return 'Miscellaneous';
  if (includesAny(lower, PANTRY_KEYWORDS)) return 'Pantry';
  return 'Miscellaneous';
}

export function groupGroceriesByCategory(items: AggregatedGroceryItem[]): Record<string, AggregatedGroceryItem[]> {
  const groups: Record<string, AggregatedGroceryItem[]> = {};

  for (const item of items) {
    const bucket = groups[item.category] ?? [];
    bucket.push(item);
    groups[item.category] = bucket;
  }

  const ordered: Record<string, AggregatedGroceryItem[]> = {};
  for (const aisle of GROCERY_AISLE_ORDER) {
    if (groups[aisle]?.length) ordered[aisle] = groups[aisle];
  }
  for (const [category, bucket] of Object.entries(groups)) {
    if (!(category in ordered)) ordered[category] = bucket;
  }

  return ordered;
}

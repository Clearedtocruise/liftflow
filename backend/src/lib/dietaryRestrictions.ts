export type DietaryStyleName =
  | 'high_protein'
  | 'low_carb'
  | 'keto'
  | 'mediterranean'
  | 'vegetarian'
  | 'balanced';

export type NutritionPreferenceInput = {
  dietaryRestrictions?: string[];
  foodPreferences?: string[];
  mealsPerDay?: number;
};

const RESTRICTION_REPLACEMENTS: Array<{
  match: RegExp;
  blocked: RegExp;
  replacement: string;
  reason: string;
}> = [
  {
    match: /nut/i,
    blocked: /nut|almond|peanut|walnut|macadamia|cashew/i,
    replacement: 'Greek yogurt with berries',
    reason: 'Nut allergy',
  },
  {
    match: /dairy|lactose/i,
    blocked: /yogurt|cheese|whey|cottage|milk|butter/i,
    replacement: 'Tofu scramble with toast',
    reason: 'Dairy-free',
  },
  {
    match: /vegan/i,
    blocked: /chicken|beef|salmon|turkey|egg|fish|steak|ribeye|yogurt|cheese|whey/i,
    replacement: 'Lentil and vegetable bowl',
    reason: 'Vegan',
  },
  {
    match: /vegetarian/i,
    blocked: /chicken|beef|salmon|turkey|fish|steak|ribeye/i,
    replacement: 'Chickpea curry with rice',
    reason: 'Vegetarian',
  },
  {
    match: /gluten/i,
    blocked: /oat|toast|pasta|couscous|bar|wrap/i,
    replacement: 'Eggs with avocado and spinach',
    reason: 'Gluten-free',
  },
  {
    match: /halal|kosher/i,
    blocked: /bacon|pork|ribeye|steak(?!\s*with)/i,
    replacement: 'Grilled chicken quinoa bowl',
    reason: 'Dietary preference',
  },
];

export function inferDietaryStyle(restrictions: string[] = []): DietaryStyleName {
  const joined = restrictions.join(' ').toLowerCase();
  if (/keto/.test(joined)) return 'keto';
  if (/low carb/.test(joined)) return 'low_carb';
  if (/vegetarian/.test(joined) && !/vegan/.test(joined)) return 'vegetarian';
  if (/mediterranean/.test(joined)) return 'mediterranean';
  if (/high protein|muscle/.test(joined)) return 'high_protein';
  return 'balanced';
}

function applyFoodPreferences(name: string, preferences: string[] = []): string {
  if (preferences.length === 0) return name;
  const lower = name.toLowerCase();
  const pref = preferences.find((item) => !lower.includes(item.toLowerCase()));
  if (!pref) return name;
  if (/chicken/i.test(pref) && !/chicken/i.test(lower)) {
    return name.replace(/salmon|beef|turkey|fish|steak|tofu|lentil/gi, 'chicken');
  }
  if (/fish/i.test(pref) && !/fish|salmon/i.test(lower)) {
    return name.replace(/chicken|beef|turkey|steak/gi, 'salmon');
  }
  if (/beef/i.test(pref) && !/beef|steak|ribeye/i.test(lower)) {
    return name.replace(/chicken|salmon|turkey|fish/gi, 'lean beef');
  }
  if (/eggs/i.test(pref) && !/egg/i.test(lower)) {
    return `Eggs with ${name.split(' ').slice(-2).join(' ')}`;
  }
  return name;
}

export function adaptMealName(
  name: string,
  mealType: string,
  prefs: NutritionPreferenceInput,
): { name: string; reason?: string } {
  let next = name;
  let reason: string | undefined;

  for (const rule of RESTRICTION_REPLACEMENTS) {
    const restrictions = prefs.dietaryRestrictions ?? [];
    if (!restrictions.some((item) => rule.match.test(item))) continue;
    if (rule.blocked.test(next)) {
      next = rule.replacement;
      reason = rule.reason;
      break;
    }
  }

  const styled = applyFoodPreferences(next, prefs.foodPreferences);
  if (styled !== next) {
    next = styled;
    reason = reason ?? 'Matched your food preferences';
  }

  if (next === name) return { name };
  return { name: next, reason: reason ?? 'Updated for your nutrition preferences' };
}

/** True when a name still violates one of the user's stated restrictions. */
export function violatesRestrictions(name: string, restrictions: string[] = []): boolean {
  if (restrictions.length === 0) return false;
  return RESTRICTION_REPLACEMENTS.some(
    (rule) => restrictions.some((item) => rule.match.test(item)) && rule.blocked.test(name),
  );
}

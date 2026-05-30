import type { MealType } from '@/types';

export type ParsedNutritionEntry = {
  name: string;
  mealType: MealType;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  isSupplement?: boolean;
  rawText: string;
};

function parseNumber(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : undefined;
}

export function parseNutritionVoice(transcript: string): ParsedNutritionEntry | null {
  const text = transcript.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const isSupplement =
    /\b(supplement|creatine|vitamin|protein powder|pre-?workout|bcaa|fish oil|multivitamin)\b/i.test(lower);

  let mealType: MealType = 'snack';
  if (/\bbreakfast\b/i.test(lower)) mealType = 'breakfast';
  else if (/\blunch\b/i.test(lower)) mealType = 'lunch';
  else if (/\bdinner\b/i.test(lower)) mealType = 'dinner';
  else if (/\bpre[- ]?workout\b/i.test(lower)) mealType = 'pre_workout';
  else if (/\bpost[- ]?workout\b/i.test(lower)) mealType = 'post_workout';

  const caloriesMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:cal(?:ories)?|kcal)/i);
  const proteinMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:protein|pro)/i);
  const carbsMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:carbs?|carbohydrate)/i);
  const fatMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:fat)/i);

  let name = text
    .replace(/\b(had|ate|drank|log|logged|supplement|for breakfast|for lunch|for dinner)\b/gi, '')
    .replace(/\d+(?:\.\d+)?\s*(?:cal(?:ories)?|kcal|g|grams?)\s*(?:protein|pro|carbs?|fat)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) {
    name = isSupplement ? 'Supplement' : 'Food';
  }

  if (!caloriesMatch && !proteinMatch && !carbsMatch && !fatMatch && !isSupplement) {
    return null;
  }

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    mealType,
    calories: parseNumber(caloriesMatch?.[1]),
    proteinG: parseNumber(proteinMatch?.[1]),
    carbsG: parseNumber(carbsMatch?.[1]),
    fatG: parseNumber(fatMatch?.[1]),
    isSupplement,
    rawText: transcript,
  };
}

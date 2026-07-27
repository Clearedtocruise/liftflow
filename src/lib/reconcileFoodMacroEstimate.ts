import type { FoodMacroEstimate } from '@/types/nutrition';

function roundMacros(base: FoodMacroEstimate): FoodMacroEstimate {
  return {
    calories: Math.round(base.calories),
    proteinG: Math.round(base.proteinG * 10) / 10,
    carbsG: Math.round(base.carbsG * 10) / 10,
    fatG: Math.round(base.fatG * 10) / 10,
    reasoning: base.reasoning,
  };
}

/**
 * Smart Replacement used to show AI totals that disagreed with the per-food numbers in the same
 * paragraph (e.g. 100+85+95=280 but the tile said 350). Prefer the itemized arithmetic.
 */
export function reconcileFoodMacroEstimate(estimate: FoodMacroEstimate): FoodMacroEstimate {
  const reasoning = estimate.reasoning?.trim();
  if (!reasoning) return roundMacros(estimate);

  const componentPattern =
    /(\d+(?:\.\d+)?)\s*calories?,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?protein,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?carbs?,\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?fat/gi;

  const components: FoodMacroEstimate[] = [];
  for (const match of reasoning.matchAll(componentPattern)) {
    components.push({
      calories: Number(match[1]),
      proteinG: Number(match[2]),
      carbsG: Number(match[3]),
      fatG: Number(match[4]),
    });
  }

  if (components.length < 2) return roundMacros(estimate);

  const itemized = components.slice(0, -1);
  const summed = roundMacros(
    itemized.reduce(
      (acc, part) => ({
        calories: acc.calories + part.calories,
        proteinG: acc.proteinG + part.proteinG,
        carbsG: acc.carbsG + part.carbsG,
        fatG: acc.fatG + part.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    ),
  );

  const headline = roundMacros(estimate);
  const disagrees =
    Math.abs(summed.calories - headline.calories) > 5 ||
    Math.abs(summed.proteinG - headline.proteinG) > 1 ||
    Math.abs(summed.carbsG - headline.carbsG) > 1 ||
    Math.abs(summed.fatG - headline.fatG) > 1;

  if (!disagrees) return headline;

  const cleaned = reasoning
    .replace(
      /Combining these estimates gives a total of approximately[^.]*\./i,
      `Combining these estimates gives a total of approximately ${summed.calories} calories, ${summed.proteinG}g of protein, ${summed.carbsG}g of carbs, and ${summed.fatG}g of fat.`,
    )
    .replace(
      /Total:\s*[^.]*\./i,
      `Total: ${summed.calories} calories, ${summed.proteinG}g protein, ${summed.carbsG}g carbs, and ${summed.fatG}g fat.`,
    );

  return { ...summed, reasoning: cleaned };
}

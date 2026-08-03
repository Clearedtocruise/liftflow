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

const FULL_COMPONENT_PATTERN =
  /(\d+(?:\.\d+)?)\s*calories?,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?protein,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?carbs?,\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?fat/gi;

/** "adds about 60 calories and 12g of protein, with negligible carbs and fat" */
const PARTIAL_COMPONENT_PATTERN =
  /(\d+(?:\.\d+)?)\s*calories?(?![^.]*\b(?:total|combined|results?)\b)[^.]*?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?protein(?:[^.]*?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?carbs?)?(?:[^.]*?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?fat)?/gi;

const TOTAL_SENTENCE_RE =
  /\b(?:combined|total|results?\s+in\s+a\s+total|altogether|overall)\b/i;

function sentenceContaining(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf('.', index - 1) + 1);
  const end = text.indexOf('.', index);
  return text.slice(start, end === -1 ? text.length : end + 1).trim();
}

function collectComponents(reasoning: string): FoodMacroEstimate[] {
  const found: FoodMacroEstimate[] = [];

  for (const match of reasoning.matchAll(FULL_COMPONENT_PATTERN)) {
    const sentence = sentenceContaining(reasoning, match.index ?? 0);
    if (TOTAL_SENTENCE_RE.test(sentence)) continue;
    found.push({
      calories: Number(match[1]),
      proteinG: Number(match[2]),
      carbsG: Number(match[3]),
      fatG: Number(match[4]),
    });
  }

  if (found.length >= 1) {
    // Still pick up partial "adds about X calories and Yg protein" lines the full pattern missed.
    for (const match of reasoning.matchAll(PARTIAL_COMPONENT_PATTERN)) {
      const sentence = sentenceContaining(reasoning, match.index ?? 0);
      if (TOTAL_SENTENCE_RE.test(sentence)) continue;
      const calories = Number(match[1]);
      const proteinG = Number(match[2]);
      const already = found.some(
        (part) =>
          Math.abs(part.calories - calories) < 1 && Math.abs(part.proteinG - proteinG) < 0.2,
      );
      if (already) continue;
      found.push({
        calories,
        proteinG,
        carbsG: match[3] != null ? Number(match[3]) : 0,
        fatG: match[4] != null ? Number(match[4]) : 0,
      });
    }
    return found;
  }

  for (const match of reasoning.matchAll(PARTIAL_COMPONENT_PATTERN)) {
    const sentence = sentenceContaining(reasoning, match.index ?? 0);
    if (TOTAL_SENTENCE_RE.test(sentence)) continue;
    found.push({
      calories: Number(match[1]),
      proteinG: Number(match[2]),
      carbsG: match[3] != null ? Number(match[3]) : 0,
      fatG: match[4] != null ? Number(match[4]) : 0,
    });
  }
  return found;
}

function rewriteClosingTotal(reasoning: string, summed: FoodMacroEstimate): string {
  return reasoning
    .replace(
      /Combined(?:\,?\s*this)?\s+results?\s+in\s+a\s+total\s+of\s+(?:approximately\s+)?[^.]*\./i,
      `Combined, this results in a total of approximately ${summed.calories} calories, ${summed.proteinG}g of protein, ${summed.carbsG}g of carbs, and ${summed.fatG}g of fat.`,
    )
    .replace(
      /Combining these estimates gives a total of approximately[^.]*\./i,
      `Combining these estimates gives a total of approximately ${summed.calories} calories, ${summed.proteinG}g of protein, ${summed.carbsG}g of carbs, and ${summed.fatG}g of fat.`,
    )
    .replace(
      /Total:\s*[^.]*\./i,
      `Total: ${summed.calories} calories, ${summed.proteinG}g protein, ${summed.carbsG}g carbs, and ${summed.fatG}g fat.`,
    );
}

/**
 * Smart Replacement used to show AI totals that disagreed with the per-food numbers in the same
 * paragraph (e.g. 100+85+95=280 but the tile said 350). Prefer the itemized arithmetic.
 */
export function reconcileFoodMacroEstimate(estimate: FoodMacroEstimate): FoodMacroEstimate {
  const reasoning = estimate.reasoning?.trim();
  if (!reasoning) return roundMacros(estimate);

  const components = collectComponents(reasoning);
  if (components.length < 2) return roundMacros(estimate);

  const summed = roundMacros(
    components.reduce(
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

  const cleaned = rewriteClosingTotal(reasoning, summed);

  // Always prefer the itemized sum when we found multiple foods — the closing sentence and
  // headline JSON are the parts that drift (egg whites narrated, then dropped from the tile).
  if (disagrees || cleaned !== reasoning) {
    return { ...summed, reasoning: cleaned };
  }

  return headline;
}

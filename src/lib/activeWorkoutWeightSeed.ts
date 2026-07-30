/**
 * Seed the weight field when the active exercise changes (including superset rotation).
 * Prefer sets already logged on this exercise in the current session so partners do not
 * wipe each other's load back to 0.
 */
export function resolveExerciseSeedWeightKg(input: {
  sessionSets: Array<{ weight?: number | null }>;
  historyWeightKg?: number | null;
  suggestedWeightKg?: number | null;
}): number {
  for (let i = input.sessionSets.length - 1; i >= 0; i -= 1) {
    const weight = input.sessionSets[i]?.weight;
    if (weight != null && weight > 0) return weight;
  }
  if (input.historyWeightKg != null && input.historyWeightKg > 0) return input.historyWeightKg;
  if (input.suggestedWeightKg != null && input.suggestedWeightKg > 0) return input.suggestedWeightKg;
  return 0;
}

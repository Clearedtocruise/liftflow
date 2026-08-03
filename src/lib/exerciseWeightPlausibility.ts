/**
 * Cap absurd plan/coach target loads for light isolation accessories.
 * Catalog mistakes (kickback tagged as horizontal_press) and swap inheritance
 * can otherwise surface compound-press weights like 175 lb on DB Kickbacks.
 */

const LB_PER_KG = 2.20462;

export function exerciseLooksLikeLightIsolationName(name?: string | null, slug?: string | null): boolean {
  const key = `${name ?? ''} ${slug ?? ''}`.toLowerCase();
  if (!key.trim()) return false;
  return /\bkickback\b|\blateral\s+raise\b|\bfront\s+raise\b|\brear\s+delt\b|\bconcentration\s+curl\b|\btricep(s)?\s+(pushdown|extension|kickback)\b|\bskull\s*crusher\b|\boverhead\s+(db\s+)?extension\b|\bcable\s+fly\b|\bpec\s+deck\b|\bleg\s+extension\b|\bleg\s+curl\b|\bcalf\s+raise\b/.test(
    key,
  );
}

function isolationCapLbs(name?: string | null, slug?: string | null): number {
  const key = `${name ?? ''} ${slug ?? ''}`.toLowerCase();
  // High enough for strong accessories; low enough to reject compound-press bleed (e.g. 175 lb).
  if (/\bkickback\b|\blateral\s+raise\b|\bfront\s+raise\b/.test(key)) return 55;
  return 70;
}

/** Returns a display/seed weight in kg, or undefined when the candidate is absurd for the lift. */
export function clampPlanWeightKgForExercise(
  weightKg: number | null | undefined,
  exerciseName?: string | null,
  exerciseSlug?: string | null,
): number | undefined {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return undefined;
  if (!exerciseLooksLikeLightIsolationName(exerciseName, exerciseSlug)) return weightKg;

  const capKg = isolationCapLbs(exerciseName, exerciseSlug) / LB_PER_KG;
  if (weightKg > capKg) return undefined;
  return weightKg;
}

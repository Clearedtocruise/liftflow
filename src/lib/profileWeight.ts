import { parseWeightToKg } from '@/lib/unitConversion';
import type { WeightUnit } from '@/types/common';

const LB_PER_KG = 2.2046226218;
export const MIN_PROFILE_WEIGHT_KG = 35;
export const MAX_PROFILE_WEIGHT_KG = 250;

export type ProfileWeightInput = { ok: true; kg: number } | { ok: false; error: string };

export function parseProfileWeightInput(text: string, unit: WeightUnit): ProfileWeightInput {
  const kg = parseWeightToKg(text, unit);
  if (kg == null || !Number.isFinite(kg)) {
    return { ok: false, error: `Enter your weight in ${unit}.` };
  }
  if (kg < MIN_PROFILE_WEIGHT_KG || kg > MAX_PROFILE_WEIGHT_KG) {
    const lo = unit === 'kg' ? MIN_PROFILE_WEIGHT_KG : Math.round(MIN_PROFILE_WEIGHT_KG * LB_PER_KG);
    const hi = unit === 'kg' ? MAX_PROFILE_WEIGHT_KG : Math.round(MAX_PROFILE_WEIGHT_KG * LB_PER_KG);
    return { ok: false, error: `Enter a weight between ${lo} and ${hi} ${unit}.` };
  }
  return { ok: true, kg: Math.round(kg * 100) / 100 };
}

/** True when `a` is ~2.2× (or 1/2.2×) `b` — a pounds number saved as kilograms, or the reverse. */
function isUnitMixup(a: number, b: number): boolean {
  const ratio = a / b;
  return Math.abs(ratio - LB_PER_KG) / LB_PER_KG < 0.03 || Math.abs(ratio - 1 / LB_PER_KG) * LB_PER_KG < 0.03;
}

export type LoggedWeight = { kg: number; recordedAt: string };

/**
 * Whether an Apple Health / Health Connect weight sample may replace the profile weight.
 * A weight the athlete logged in the app wins over an older or same-time Health sample,
 * and a sample that is a unit mix-up of their logged weight is never applied.
 */
export function shouldApplyHealthWeight(sample: LoggedWeight, lastLogged: LoggedWeight | null): boolean {
  if (!Number.isFinite(sample.kg) || sample.kg < MIN_PROFILE_WEIGHT_KG || sample.kg > MAX_PROFILE_WEIGHT_KG) {
    return false;
  }
  if (!lastLogged || !(lastLogged.kg > 0)) return true;
  if (isUnitMixup(sample.kg, lastLogged.kg)) return false;
  return Date.parse(sample.recordedAt) > Date.parse(lastLogged.recordedAt);
}

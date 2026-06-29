/** Weight display helpers — mirror src/lib/unitConversion.ts for backend coach copy. */

export const LB_PER_KG = 2.2046226218;

export type WeightUnit = 'lb' | 'kg';

export type ProfileWeightUnitSource = {
  preferred_weight_unit?: string | null;
  preferred_units?: string | null;
};

/** Match client resolveUnitPreferences weight resolution. */
export function resolveWeightUnit(profile: ProfileWeightUnitSource | null | undefined): WeightUnit {
  if (profile?.preferred_weight_unit === 'kg' || profile?.preferred_weight_unit === 'lb') {
    return profile.preferred_weight_unit;
  }
  if (profile?.preferred_units === 'metric') return 'kg';
  return 'lb';
}

export function weightStepDisplay(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 5;
}

export function displayWeightFromKg(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') {
    const v = Math.round(kg * 10) / 10;
    return v % 1 === 0 ? Math.round(v) : v;
  }
  return Math.round(kg * LB_PER_KG);
}

/** ~2.5% load bump snapped to gym-standard steps (2.5 kg or 5 lb). Weight stored in kg. */
export function formatProgressionIncrease(suggestedWeightKg: number, unit: WeightUnit): string {
  const step = weightStepDisplay(unit);
  const displayWeight = displayWeightFromKg(suggestedWeightKg, unit);
  const increaseDisplay = Math.max(step, Math.round((displayWeight * 0.025) / step) * step);
  if (unit === 'kg') {
    const text = increaseDisplay % 1 === 0 ? String(Math.round(increaseDisplay)) : String(increaseDisplay);
    return `${text} kg`;
  }
  return `${Math.round(increaseDisplay)} lb`;
}

export function formatVolumeLabel(totalVolumeKg: number, unit: WeightUnit): string {
  if (!totalVolumeKg || totalVolumeKg <= 0) return '—';
  const value = unit === 'kg' ? totalVolumeKg : totalVolumeKg * LB_PER_KG;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

import type {
    DistanceUnit,
    HeightUnit,
    MeasurementUnit,
    UnitPreferences,
    WaterUnit,
    WeightUnit,
} from '@/constants/units';
import {
    DEFAULT_UNIT_PREFERENCES,
    METRIC_UNIT_PREFERENCES,
} from '@/constants/units';
import type { PreferredUnits } from '@/types/common';
import type { UserProfile } from '@/types/user';

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const KM_PER_MI = 1.609344;
const ML_PER_OZ = 29.5735;

function parseNumeric(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

export function resolveUnitPreferences(profile: Partial<UserProfile> | null | undefined): UnitPreferences {
  if (!profile) return DEFAULT_UNIT_PREFERENCES;

  const hasGranular =
    profile.preferredHeightUnit != null ||
    profile.preferredWeightUnit != null ||
    profile.preferredDistanceUnit != null ||
    profile.preferredMeasurementUnit != null ||
    profile.preferredWaterUnit != null;

  if (hasGranular) {
    return {
      preferredHeightUnit: profile.preferredHeightUnit ?? DEFAULT_UNIT_PREFERENCES.preferredHeightUnit,
      preferredWeightUnit: profile.preferredWeightUnit ?? DEFAULT_UNIT_PREFERENCES.preferredWeightUnit,
      preferredDistanceUnit: profile.preferredDistanceUnit ?? DEFAULT_UNIT_PREFERENCES.preferredDistanceUnit,
      preferredMeasurementUnit:
        profile.preferredMeasurementUnit ?? DEFAULT_UNIT_PREFERENCES.preferredMeasurementUnit,
      preferredWaterUnit: profile.preferredWaterUnit ?? DEFAULT_UNIT_PREFERENCES.preferredWaterUnit,
    };
  }

  return profile.preferredUnits === 'metric' ? METRIC_UNIT_PREFERENCES : DEFAULT_UNIT_PREFERENCES;
}

export function preferredUnitsFromGranular(prefs: UnitPreferences): PreferredUnits {
  const metric =
    prefs.preferredWeightUnit === 'kg' &&
    prefs.preferredDistanceUnit === 'km' &&
    prefs.preferredHeightUnit === 'cm' &&
    prefs.preferredMeasurementUnit === 'cm';
  return metric ? 'metric' : 'imperial';
}

export function formatWeight(kg: number | undefined, unit: WeightUnit): string {
  if (kg == null || Number.isNaN(kg)) return '—';
  if (unit === 'kg') {
    const rounded = Math.round(kg * 10) / 10;
    return `${rounded % 1 === 0 ? Math.round(rounded) : rounded} kg`;
  }
  return `${Math.round(kg * LB_PER_KG)} lb`;
}

export function parseWeightToKg(value: string | undefined, unit: WeightUnit): number | undefined {
  const n = parseNumeric(value);
  if (n == null) return undefined;
  return unit === 'kg' ? n : n / LB_PER_KG;
}

export function weightUnitLabel(unit: WeightUnit): string {
  return unit === 'kg' ? 'kg' : 'lb';
}

export function formatHeight(cm: number | undefined, unit: HeightUnit): string {
  if (cm == null || Number.isNaN(cm)) return '—';
  if (unit === 'cm') return `${Math.round(cm)} cm`;

  const totalIn = cm / CM_PER_IN;
  if (unit === 'in') return `${Math.round(totalIn)} in`;

  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - ft * 12);
  const adjustedFt = inches === 12 ? ft + 1 : ft;
  const adjustedIn = inches === 12 ? 0 : inches;
  return `${adjustedFt}' ${adjustedIn}"`;
}

export function parseHeightCm(value: string | undefined): number | undefined {
  const n = parseNumeric(value);
  return n == null ? undefined : n;
}

export function parseHeightIn(value: string | undefined): number | undefined {
  const n = parseNumeric(value);
  return n == null ? undefined : n * CM_PER_IN;
}

export function parseHeightFtIn(feet: string | undefined, inches: string | undefined): number | undefined {
  const ft = parseNumeric(feet);
  const inch = parseNumeric(inches) ?? 0;
  if (ft == null && !inches?.trim()) return undefined;
  const totalIn = (ft ?? 0) * 12 + inch;
  return totalIn * CM_PER_IN;
}

export function heightInputLabel(unit: HeightUnit): string {
  if (unit === 'cm') return 'Height (cm)';
  if (unit === 'in') return 'Height (in)';
  return 'Height';
}

export function formatMeasurement(cm: number | undefined, unit: MeasurementUnit): string {
  if (cm == null || Number.isNaN(cm)) return '—';
  if (unit === 'cm') return `${Math.round(cm * 10) / 10} cm`;
  return `${Math.round((cm / CM_PER_IN) * 10) / 10} in`;
}

export function parseMeasurementToCm(value: string | undefined, unit: MeasurementUnit): number | undefined {
  const n = parseNumeric(value);
  if (n == null) return undefined;
  return unit === 'cm' ? n : n * CM_PER_IN;
}

export function measurementUnitLabel(unit: MeasurementUnit): string {
  return unit === 'cm' ? 'cm' : 'in';
}

export function formatDistance(km: number | undefined, unit: DistanceUnit): string {
  if (km == null || Number.isNaN(km)) return '—';
  if (unit === 'km') {
    const rounded = Math.round(km * 100) / 100;
    return `${rounded} km`;
  }
  return `${Math.round((km / KM_PER_MI) * 100) / 100} mi`;
}

export function parseDistanceToKm(value: string | undefined, unit: DistanceUnit): number | undefined {
  const n = parseNumeric(value);
  if (n == null) return undefined;
  return unit === 'km' ? n : n * KM_PER_MI;
}

export function formatWater(ml: number | undefined, unit: WaterUnit): string {
  if (ml == null || Number.isNaN(ml)) return '—';
  if (unit === 'L') {
    const liters = Math.round((ml / 1000) * 10) / 10;
    return `${liters % 1 === 0 ? Math.round(liters) : liters} L`;
  }
  return `${Math.round(ml / ML_PER_OZ)} oz`;
}

export function parseWaterToMl(value: string | undefined, unit: WaterUnit): number | undefined {
  const n = parseNumeric(value);
  if (n == null) return undefined;
  return unit === 'L' ? n * 1000 : n * ML_PER_OZ;
}

export function weightStepKg(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 2.5 / LB_PER_KG;
}

export function weightStepDisplay(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 5;
}

/** Convert voice-parsed weight to kg using explicit units in transcript or user preference. */
export function normalizeVoiceWeightToKg(
  weight: number | undefined,
  transcript: string,
  unit: WeightUnit,
): number | undefined {
  if (weight == null || Number.isNaN(weight)) return undefined;
  const lower = transcript.toLowerCase();
  if (/\b(kg|kilos?|kilograms?)\b/.test(lower)) return weight;
  if (/\b(lbs?|pounds?)\b/.test(lower)) return weight / LB_PER_KG;
  return parseWeightToKg(String(weight), unit);
}

/** Convert workout set weight from kg storage to display value string. */
export function formatWorkoutWeightForInput(kg: number | undefined, unit: WeightUnit): string {
  if (kg == null || Number.isNaN(kg)) return '';
  if (unit === 'kg') {
    const v = Math.round(kg * 10) / 10;
    return String(v % 1 === 0 ? Math.round(v) : v);
  }
  return String(Math.round(kg * LB_PER_KG));
}

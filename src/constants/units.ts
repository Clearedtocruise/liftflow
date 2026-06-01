/**
 * User-facing unit preferences. Internal storage remains metric (cm, kg, km, ml).
 */

export type HeightUnit = 'ft_in' | 'in' | 'cm';
export type WeightUnit = 'lb' | 'kg';
export type DistanceUnit = 'mi' | 'km';
export type MeasurementUnit = 'in' | 'cm';
export type WaterUnit = 'oz' | 'L';

export type UnitPreferences = {
  preferredHeightUnit: HeightUnit;
  preferredWeightUnit: WeightUnit;
  preferredDistanceUnit: DistanceUnit;
  preferredMeasurementUnit: MeasurementUnit;
  preferredWaterUnit: WaterUnit;
};

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  preferredHeightUnit: 'ft_in',
  preferredWeightUnit: 'lb',
  preferredDistanceUnit: 'mi',
  preferredMeasurementUnit: 'in',
  preferredWaterUnit: 'oz',
};

export const METRIC_UNIT_PREFERENCES: UnitPreferences = {
  preferredHeightUnit: 'cm',
  preferredWeightUnit: 'kg',
  preferredDistanceUnit: 'km',
  preferredMeasurementUnit: 'cm',
  preferredWaterUnit: 'L',
};

export const HEIGHT_UNIT_OPTIONS: { id: HeightUnit; label: string }[] = [
  { id: 'ft_in', label: 'Feet & Inches' },
  { id: 'in', label: 'Inches' },
  { id: 'cm', label: 'Centimeters' },
];

export const WEIGHT_UNIT_OPTIONS: { id: WeightUnit; label: string }[] = [
  { id: 'lb', label: 'Pounds' },
  { id: 'kg', label: 'Kilograms' },
];

export const DISTANCE_UNIT_OPTIONS: { id: DistanceUnit; label: string }[] = [
  { id: 'mi', label: 'Miles' },
  { id: 'km', label: 'Kilometers' },
];

export const MEASUREMENT_UNIT_OPTIONS: { id: MeasurementUnit; label: string }[] = [
  { id: 'in', label: 'Inches' },
  { id: 'cm', label: 'Centimeters' },
];

export const WATER_UNIT_OPTIONS: { id: WaterUnit; label: string }[] = [
  { id: 'oz', label: 'Ounces' },
  { id: 'L', label: 'Liters' },
];

export function summarizeUnitPreferences(prefs: UnitPreferences): string {
  const weight = prefs.preferredWeightUnit === 'lb' ? 'Imperial' : 'Metric';
  return `${weight} · ${prefs.preferredHeightUnit === 'cm' ? 'cm' : 'ft/in'}`;
}

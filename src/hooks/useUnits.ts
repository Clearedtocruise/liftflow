import { useMemo } from 'react';

import type { UnitPreferences } from '@/constants/units';
import { useAuth } from '@/hooks/useAuth';
import {
    formatDistance,
    formatHeight,
    formatMeasurement,
    formatWater,
    formatWeight,
    heightInputLabel,
    measurementUnitLabel,
    parseDistanceToKm,
    parseHeightCm,
    parseHeightFtIn,
    parseHeightIn,
    parseMeasurementToCm,
    parseWaterToMl,
    parseWeightToKg,
    resolveUnitPreferences,
    weightStepKg,
    weightUnitLabel,
} from '@/lib/unitConversion';

export function useUnits(override?: Partial<UnitPreferences>) {
  const { user } = useAuth();

  const prefs = useMemo(() => {
    const base = resolveUnitPreferences(user);
    return override ? { ...base, ...override } : base;
  }, [user, override]);

  return useMemo(
    () => ({
      ...prefs,
      formatWeight: (kg?: number) => formatWeight(kg, prefs.preferredWeightUnit),
      parseWeight: (value?: string) => parseWeightToKg(value, prefs.preferredWeightUnit),
      weightLabel: weightUnitLabel(prefs.preferredWeightUnit),
      weightStepKg: () => weightStepKg(prefs.preferredWeightUnit),
      formatHeight: (cm?: number) => formatHeight(cm, prefs.preferredHeightUnit),
      parseHeightCm: (value?: string) => parseHeightCm(value),
      parseHeightIn: (value?: string) => parseHeightIn(value),
      parseHeightFtIn: (feet?: string, inches?: string) => parseHeightFtIn(feet, inches),
      heightInputLabel: heightInputLabel(prefs.preferredHeightUnit),
      formatMeasurement: (cm?: number) => formatMeasurement(cm, prefs.preferredMeasurementUnit),
      parseMeasurement: (value?: string) => parseMeasurementToCm(value, prefs.preferredMeasurementUnit),
      measurementLabel: measurementUnitLabel(prefs.preferredMeasurementUnit),
      formatDistance: (km?: number) => formatDistance(km, prefs.preferredDistanceUnit),
      parseDistance: (value?: string) => parseDistanceToKm(value, prefs.preferredDistanceUnit),
      formatWater: (ml?: number) => formatWater(ml, prefs.preferredWaterUnit),
      parseWater: (value?: string) => parseWaterToMl(value, prefs.preferredWaterUnit),
    }),
    [prefs],
  );
}

export type UnitsFormatter = ReturnType<typeof useUnits>;

import type { HealthMetricSample } from '@/integrations/types';
import type { CardioType } from '@/types/common';

/** Apple HKWorkoutActivityType raw values we import into cardio history. */
const HK_ACTIVITY_TO_CARDIO: Record<number, { cardioType: CardioType; label: string }> = {
  37: { cardioType: 'run', label: 'Outdoor Run' },
  52: { cardioType: 'walk', label: 'Walk' },
  13: { cardioType: 'cycle', label: 'Bike' },
  46: { cardioType: 'swim', label: 'Swim' },
  16: { cardioType: 'elliptical', label: 'Elliptical' },
  63: { cardioType: 'hiit', label: 'HIIT' },
  35: { cardioType: 'row', label: 'Row' },
  45: { cardioType: 'other', label: 'Stair Climb' },
};

export type HealthKitCardioImport = {
  cardioType: CardioType;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  notes: string;
  metadata: {
    source: 'apple_healthkit';
    external_id: string;
    activity_type: number | string;
    activityKind: 'cardio';
    calorieKind: 'active';
  };
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Map a HealthKit workout_session sample into a cardio_sessions insert payload.
 * Returns null for strength / unsupported activity types.
 */
export function mapHealthKitWorkoutToCardio(sample: HealthMetricSample): HealthKitCardioImport | null {
  if (sample.dataType !== 'workout_session') return null;
  if (!sample.externalId) return null;

  const activityRaw = sample.value.activityType;
  const activityType =
    typeof activityRaw === 'number'
      ? activityRaw
      : typeof activityRaw === 'string'
        ? Number.parseInt(activityRaw, 10)
        : NaN;

  const mapped = Number.isFinite(activityType) ? HK_ACTIVITY_TO_CARDIO[activityType] : undefined;
  if (!mapped) return null;

  const durationSeconds = Math.max(0, Math.round(asNumber(sample.value.durationSeconds) ?? 0));
  if (durationSeconds < 60) return null;

  const startedAt = sample.recordedAt;
  const endedAt = new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString();
  const distanceMeters = asNumber(sample.value.distanceMeters);
  const calories = asNumber(sample.value.calories);

  return {
    cardioType: mapped.cardioType,
    startedAt,
    endedAt,
    durationSeconds,
    distanceMeters: distanceMeters != null && distanceMeters > 0 ? distanceMeters : undefined,
    caloriesBurned: calories != null && calories > 0 ? Math.round(calories) : undefined,
    notes: mapped.label,
    metadata: {
      source: 'apple_healthkit',
      external_id: sample.externalId,
      activity_type: Number.isFinite(activityType) ? activityType : String(activityRaw ?? ''),
      activityKind: 'cardio',
      calorieKind: 'active',
    },
  };
}

export function isHealthKitCardioSample(sample: HealthMetricSample): boolean {
  return mapHealthKitWorkoutToCardio(sample) != null;
}

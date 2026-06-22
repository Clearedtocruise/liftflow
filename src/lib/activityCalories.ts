import type { CardioType } from '@/types/common';

/** Compendium of Physical Activities–style MET estimates (moderate effort unless noted). */
const MET_BY_CARDIO_TYPE: Record<CardioType, number> = {
  walk: 3.5,
  run: 9.8,
  cycle: 7.5,
  row: 7.0,
  swim: 8.0,
  hiit: 8.5,
  treadmill: 8.0,
  elliptical: 5.0,
  other: 5.5,
};

const MET_BY_SPORT_ID: Record<string, number> = {
  basketball: 6.5,
  pickleball: 6.0,
  tennis: 7.0,
  soccer: 7.0,
  football: 8.0,
  hockey: 8.0,
  volleyball: 4.0,
  golf: 4.3,
  baseball: 5.0,
  softball: 5.0,
  'martial-arts': 10.0,
  wrestling: 6.0,
  boxing: 9.0,
  mma: 10.0,
  surfing: 3.0,
  skateboarding: 5.0,
  hiking: 6.0,
  equestrian: 5.5,
  'other-sport': 5.5,
};

const INTENSITY_MET_MULTIPLIER = {
  low: 0.85,
  moderate: 1,
  high: 1.2,
} as const;

export type ActivityCalorieInput = {
  durationSeconds: number;
  weightKg?: number;
  cardioType?: CardioType;
  sportId?: string;
  intensity?: 'low' | 'moderate' | 'high';
  distanceMeters?: number;
  activityLabel?: string;
};

const DEFAULT_WEIGHT_KG = 75;

function resolveMet(input: ActivityCalorieInput): number {
  if (input.sportId) {
    const base = MET_BY_SPORT_ID[input.sportId] ?? MET_BY_CARDIO_TYPE.other;
    const mult = input.intensity ? INTENSITY_MET_MULTIPLIER[input.intensity] : 1;
    return base * mult;
  }

  let met = MET_BY_CARDIO_TYPE[input.cardioType ?? 'other'];

  if (input.cardioType === 'walk' && input.distanceMeters && input.durationSeconds > 0) {
    const speedMps = input.distanceMeters / input.durationSeconds;
    const speedMph = speedMps * 2.23694;
    if (speedMph < 2) met = 2.5;
    else if (speedMph < 3) met = 3.0;
    else if (speedMph < 4) met = 3.5;
    else met = 4.3;
  }

  if (input.cardioType === 'run' && input.distanceMeters && input.durationSeconds > 0) {
    const speedMps = input.distanceMeters / input.durationSeconds;
    const paceMinPerKm = 1000 / speedMps / 60;
    if (paceMinPerKm > 8) met = 7.0;
    else if (paceMinPerKm > 6.5) met = 9.8;
    else met = 11.5;
  }

  return met;
}

/** Estimated active calories from duration, body weight, and activity type. */
export function estimateActivityCalories(input: ActivityCalorieInput): {
  calories: number;
  met: number;
  weightKg: number;
} {
  const weightKg = input.weightKg && input.weightKg > 0 ? input.weightKg : DEFAULT_WEIGHT_KG;
  const durationHours = Math.max(input.durationSeconds, 60) / 3600;
  const met = resolveMet(input);
  const calories = Math.round(met * weightKg * durationHours);

  return { calories, met, weightKg };
}

export function formatCalorieEstimate(calories: number, usedDefaultWeight: boolean): string {
  const base = `~${calories} cal`;
  return usedDefaultWeight ? `${base} (estimate — add weight in profile for accuracy)` : `${base} estimated`;
}

import { Platform } from 'react-native';

import { HEALTHKIT_READ_PERMISSIONS } from './healthConstants';
import type { HealthMetricSample, HealthSyncResult, IntegrationAvailability } from './types';

type HealthKitModule = {
  isHealthDataAvailableAsync: () => Promise<boolean>;
  requestAuthorization: (opts: { toRead: readonly string[]; toShare?: readonly string[] }) => Promise<boolean>;
  queryQuantitySamples: (
    id: string,
    filter: { from: Date; to: Date; limit: number },
  ) => Promise<{ uuid: string; quantity: number; endDate: Date; startDate?: Date }[]>;
  queryCategorySamples?: (
    id: string,
    filter: { from: Date; to: Date; limit: number },
  ) => Promise<{ uuid: string; value: number; startDate: Date; endDate: Date }[]>;
  queryWorkoutSamples: (filter: { from: Date; to: Date; limit: number }) => Promise<
    {
      uuid: string;
      workoutActivityType: number;
      duration: number | { quantity: number };
      totalEnergyBurned?: { quantity: number };
      totalDistance?: { quantity: number };
      startDate: Date;
    }[]
  >;
};

function loadHealthKit(): HealthKitModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    return null;
  }
}

export { HEALTH_DATA_TYPES } from './healthConstants';

export function getHealthKitAvailability(): IntegrationAvailability {
  if (Platform.OS !== 'ios') {
    return { available: false, reason: 'Apple Health is available on iOS only.' };
  }
  if (!loadHealthKit()) {
    return {
      available: false,
      reason: 'Apple Health requires a development build. Expo Go cannot access HealthKit.',
    };
  }
  return { available: true };
}

export async function requestHealthKitAuthorization(): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return false;
  const toRead = [
    ...HEALTHKIT_READ_PERMISSIONS.quantity,
    ...HEALTHKIT_READ_PERMISSIONS.category,
    ...HEALTHKIT_READ_PERMISSIONS.workout,
  ];
  return hk.requestAuthorization({ toRead });
}

/** HK sleep category: 0=inBed, 1=asleep, 2=awake (common mapping) */
function sleepHoursFromCategory(value: number, start: Date, end: Date): number {
  if (value === 1 || value === 0) {
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  }
  return 0;
}

export async function fetchHealthKitSamples(since: Date): Promise<HealthMetricSample[]> {
  const hk = loadHealthKit();
  if (!hk) return [];

  const now = new Date();
  const filter = { from: since, to: now, limit: 500 };
  const samples: HealthMetricSample[] = [];

  const steps = await hk.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', filter);
  for (const s of steps) {
    samples.push({
      dataType: 'steps',
      externalId: s.uuid,
      value: { count: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'count',
    });
  }

  const weights = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', filter);
  for (const s of weights) {
    samples.push({
      dataType: 'weight',
      externalId: s.uuid,
      value: { kg: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'kg',
    });
  }

  const calories = await hk.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', filter);
  for (const s of calories) {
    samples.push({
      dataType: 'active_calories',
      externalId: s.uuid,
      value: { kcal: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'kcal',
    });
  }

  const heartRates = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', filter);
  for (const s of heartRates) {
    samples.push({
      dataType: 'heart_rate',
      externalId: s.uuid,
      value: { bpm: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'bpm',
    });
  }

  const restingHr = await hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', filter);
  for (const s of restingHr) {
    samples.push({
      dataType: 'resting_heart_rate',
      externalId: s.uuid,
      value: { bpm: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'bpm',
    });
  }

  const hrv = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', filter);
  for (const s of hrv) {
    samples.push({
      dataType: 'hrv',
      externalId: s.uuid,
      value: { ms: s.quantity, sdnn: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'ms',
    });
  }

  if (hk.queryCategorySamples) {
    const sleepSamples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', filter);
    for (const s of sleepSamples) {
      const hours = sleepHoursFromCategory(s.value, s.startDate, s.endDate);
      if (hours <= 0) continue;
      samples.push({
        dataType: 'sleep',
        externalId: s.uuid,
        value: { hours, durationHours: hours, sleepValue: s.value },
        recordedAt: s.endDate.toISOString(),
        unit: 'h',
      });
    }
  }

  const distances = await hk.queryQuantitySamples('HKQuantityTypeIdentifierDistanceWalkingRunning', filter);
  for (const s of distances) {
    samples.push({
      dataType: 'distance',
      externalId: s.uuid,
      value: { meters: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'm',
    });
  }

  const exercise = await hk.queryQuantitySamples('HKQuantityTypeIdentifierAppleExerciseTime', filter);
  for (const s of exercise) {
    samples.push({
      dataType: 'exercise_minutes',
      externalId: s.uuid,
      value: { minutes: s.quantity },
      recordedAt: s.endDate.toISOString(),
      unit: 'min',
    });
  }

  const workouts = await hk.queryWorkoutSamples(filter);
  for (const w of workouts) {
    samples.push({
      dataType: 'workout_session',
      externalId: w.uuid,
      value: {
        activityType: w.workoutActivityType,
        durationSeconds: typeof w.duration === 'number' ? w.duration : w.duration?.quantity,
        calories: w.totalEnergyBurned?.quantity,
        distanceMeters: w.totalDistance?.quantity,
      },
      recordedAt: w.startDate.toISOString(),
    });
  }

  return samples;
}

export async function syncHealthKitFromDevice(sinceDays = 30): Promise<HealthSyncResult & { samples: HealthMetricSample[] }> {
  if (Platform.OS !== 'ios') {
    return { synced: 0, dataTypes: [], errors: ['iOS only'], samples: [] };
  }

  const hk = loadHealthKit();
  if (!hk) {
    return {
      synced: 0,
      dataTypes: [],
      errors: ['Apple Health requires a development build (not Expo Go).'],
      samples: [],
    };
  }

  try {
    const available = await hk.isHealthDataAvailableAsync();
    if (!available) {
      return { synced: 0, dataTypes: [], errors: ['Health data not available on this device'], samples: [] };
    }

    const authorized = await requestHealthKitAuthorization();
    if (!authorized) {
      return { synced: 0, dataTypes: [], errors: ['HealthKit authorization denied'], samples: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const samples = await fetchHealthKitSamples(since);
    const dataTypes = [...new Set(samples.map((s) => s.dataType))];
    return { synced: samples.length, dataTypes, errors: [], samples };
  } catch (error) {
    return {
      synced: 0,
      dataTypes: [],
      errors: [error instanceof Error ? error.message : 'HealthKit sync failed'],
      samples: [],
    };
  }
}

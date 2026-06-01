import { Platform } from 'react-native';

import type { HealthMetricSample, HealthSyncResult, IntegrationAvailability } from './types';

/** Health Connect record types ONE MORE imports (Android) */
export const HEALTH_CONNECT_DATA_TYPES = [
  'steps',
  'weight',
  'active_calories',
  'heart_rate',
  'exercise_session',
  'distance',
  'exercise_minutes',
] as const;

type HealthConnectModule = {
  initialize: () => Promise<boolean>;
  requestPermission: (permissions: { accessType: string; recordType: string }[]) => Promise<boolean>;
  readRecords: (recordType: string, options: { timeRangeFilter: { operator: string; startTime: string; endTime: string } }) => Promise<{ records: Record<string, unknown>[] }>;
};

function loadHealthConnect(): HealthConnectModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    // Optional native module — requires react-native-health-connect + EAS Android build
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-health-connect');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export function getHealthConnectAvailability(): IntegrationAvailability {
  if (Platform.OS !== 'android') {
    return { available: false, reason: 'Health Connect is available on Android only.' };
  }
  if (!loadHealthConnect()) {
    return {
      available: false,
      reason: 'Health Connect native module not linked. Run an EAS Android build with react-native-health-connect.',
    };
  }
  return { available: true };
}

export async function fetchHealthConnectSamples(since: Date): Promise<HealthMetricSample[]> {
  const hc = loadHealthConnect();
  if (!hc) return [];

  const now = new Date();
  const timeRange = {
    operator: 'between',
    startTime: since.toISOString(),
    endTime: now.toISOString(),
  };

  const samples: HealthMetricSample[] = [];

  const recordMap: { type: string; dataType: string; map: (r: Record<string, unknown>) => Record<string, unknown> }[] = [
    { type: 'Steps', dataType: 'steps', map: (r) => ({ count: r.count }) },
    { type: 'Weight', dataType: 'weight', map: (r) => ({ kg: (r.weight as { inKilograms?: number })?.inKilograms ?? r.weight }) },
    { type: 'ActiveCaloriesBurned', dataType: 'active_calories', map: (r) => ({ kcal: (r.energy as { inKilocalories?: number })?.inKilocalories ?? r.energy }) },
    { type: 'HeartRate', dataType: 'heart_rate', map: (r) => ({ bpm: r.beatsPerMinute ?? r.samples }) },
    { type: 'Distance', dataType: 'distance', map: (r) => ({ meters: (r.distance as { inMeters?: number })?.inMeters ?? r.distance }) },
    { type: 'ExerciseSession', dataType: 'exercise_minutes', map: (r) => ({ minutes: r.endTime && r.startTime ? (new Date(String(r.endTime)).getTime() - new Date(String(r.startTime)).getTime()) / 60000 : 0 }) },
  ];

  for (const { type, dataType, map } of recordMap) {
    try {
      const result = await hc.readRecords(type, { timeRangeFilter: timeRange });
      for (const record of result.records) {
        samples.push({
          dataType,
          externalId: String((record.metadata as { id?: string })?.id ?? record.id ?? ''),
          value: map(record),
          recordedAt: String(record.startTime ?? record.time ?? now.toISOString()),
        });
      }
    } catch {
      // Skip unsupported record types on this device
    }
  }

  return samples;
}

export async function syncHealthConnectFromDevice(sinceDays = 30): Promise<HealthSyncResult> {
  const availability = getHealthConnectAvailability();
  if (!availability.available) {
    return { synced: 0, dataTypes: [], errors: [availability.reason ?? 'Health Connect unavailable'] };
  }

  const hc = loadHealthConnect()!;
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  try {
    const initialized = await hc.initialize();
    if (!initialized) {
      return { synced: 0, dataTypes: [], errors: ['Health Connect not available on device'] };
    }

    await hc.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Weight' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'Distance' },
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    const samples = await fetchHealthConnectSamples(since);
    const dataTypes = [...new Set(samples.map((s) => s.dataType))];
    return { synced: samples.length, dataTypes, errors: [] };
  } catch (error) {
    return {
      synced: 0,
      dataTypes: [],
      errors: [error instanceof Error ? error.message : 'Health Connect sync failed'],
    };
  }
}

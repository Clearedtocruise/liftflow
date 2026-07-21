import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { HEALTH_DATA_LABELS, HEALTH_DATA_TYPES, type HealthPermissionStatus } from '@/integrations/healthConstants';
import {
    fetchHealthKitSamples,
    getHealthKitAvailability,
    requestHealthKitAuthorization,
    syncHealthKitFromDevice,
} from '@/integrations/healthkitProvider';
import type { HealthMetricSample, HealthSyncResult } from '@/integrations/types';
import {
    canRunThrottled,
    dedupeInFlight,
    egressKey,
    markThrottle,
    peekThrottleAgeMs,
    recordEgress,
} from '@/lib/egressGuard';
import {
    mergeHealthSamples,
    summarizeHealthByDay,
    type HealthDailySummary,
    type StoredHealthSample,
} from '@/lib/healthSyncEngine';
import { mapHealthKitWorkoutToCardio } from '@/lib/mapHealthKitWorkoutToCardio';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken, supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

export type HealthServiceStatus = {
  permission: HealthPermissionStatus;
  availabilityReason?: string;
  connected: boolean;
  lastSyncAt?: string;
  supportedTypes: string[];
};

export type HealthSyncReport = HealthSyncResult & {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
  importedCardio: number;
  throttled?: boolean;
};

/** Automatic HealthKit→Supabase syncs are expensive; throttle aggressively. */
const HEALTH_SYNC_MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SUMMARY_TYPES = [
  'steps',
  'active_calories',
  'sleep',
  'resting_heart_rate',
  'hrv',
  'weight',
  'workout_session',
] as const;

/** Types persisted during HealthKit sync (excludes continuous heart_rate). */
const SYNC_PERSIST_TYPES = [
  ...SUMMARY_TYPES,
  'distance',
  'exercise_minutes',
] as const;

function syncThrottleKey(userId: string): string {
  return egressKey(['healthSync', userId]);
}

function syncStorageKey(userId: string): string {
  return `@liftflow/health-sync-at/${userId}`;
}

async function readPersistedSyncAt(userId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(syncStorageKey(userId));
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

async function writePersistedSyncAt(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(syncStorageKey(userId), String(Date.now()));
  } catch {
    // non-blocking
  }
}

async function importHealthKitWorkoutsAsCardio(
  userId: string,
  samples: HealthMetricSample[],
): Promise<number> {
  const mapped = samples
    .map((sample) => mapHealthKitWorkoutToCardio(sample))
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (mapped.length === 0) return 0;

  const { data: existing } = await supabase
    .from('cardio_sessions')
    .select('id, metadata')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(200);

  const knownIds = new Set<string>();
  for (const row of existing ?? []) {
    const externalId = (row.metadata as { external_id?: string } | null)?.external_id;
    if (externalId) knownIds.add(externalId);
  }

  let imported = 0;
  for (const workout of mapped) {
    if (knownIds.has(workout.metadata.external_id)) continue;

    const { error } = await supabase.from('cardio_sessions').insert({
      user_id: userId,
      cardio_type: workout.cardioType,
      started_at: workout.startedAt,
      ended_at: workout.endedAt,
      duration_seconds: workout.durationSeconds,
      distance_meters: workout.distanceMeters ?? null,
      calories_burned: workout.caloriesBurned ?? null,
      notes: workout.notes,
      metadata: workout.metadata,
    });

    if (!error) {
      knownIds.add(workout.metadata.external_id);
      imported += 1;
    }
  }

  return imported;
}

async function fetchExistingSamples(
  userId: string,
  since: Date,
  options?: { dataTypes?: readonly string[]; limit?: number },
): Promise<StoredHealthSample[]> {
  const limit = options?.limit ?? 800;
  let query = supabase
    .from('healthkit_sync_records')
    .select('id, user_id, data_type, external_id, value, recorded_at, synced_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (options?.dataTypes?.length) {
    query = query.in('data_type', [...options.dataTypes]);
  }

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    dataType: row.data_type,
    externalId: row.external_id,
    value: row.value as Record<string, unknown>,
    recordedAt: row.recorded_at,
    syncedAt: row.synced_at,
    source: (row.value as { provider?: string })?.provider,
  }));
}

async function persistMerged(
  userId: string,
  toInsert: StoredHealthSample[],
  toUpdate: StoredHealthSample[],
): Promise<number> {
  let count = 0;

  if (toInsert.length > 0) {
    const { error } = await supabase.from('healthkit_sync_records').upsert(
      toInsert.map((s) => ({
        user_id: userId,
        data_type: s.dataType,
        external_id: s.externalId,
        value: s.value,
        recorded_at: s.recordedAt,
        synced_at: s.syncedAt ?? new Date().toISOString(),
      })),
      { onConflict: 'user_id,data_type,external_id', ignoreDuplicates: false },
    );
    if (!error) count += toInsert.length;
    else {
      for (const row of toInsert) {
        const { error: rowError } = await supabase.from('healthkit_sync_records').insert({
          user_id: userId,
          data_type: row.dataType,
          external_id: row.externalId,
          value: row.value,
          recorded_at: row.recordedAt,
        });
        if (!rowError) count += 1;
      }
    }
  }

  for (const row of toUpdate) {
    if (!row.id) continue;
    const { error } = await supabase
      .from('healthkit_sync_records')
      .update({ value: row.value, recorded_at: row.recordedAt, synced_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!error) count += 1;
  }

  return count;
}

export const healthService = {
  getSupportedTypes: () => [...HEALTH_DATA_TYPES],

  getTypeLabels: () => HEALTH_DATA_LABELS,

  getAvailability: getHealthKitAvailability,

  async getStatus(userId: string): Promise<ServiceResult<HealthServiceStatus>> {
    try {
      const availability = getHealthKitAvailability();
      const { data } = await supabase
        .from('integration_connections')
        .select('is_connected, last_sync_at')
        .eq('user_id', userId)
        .eq('provider', 'apple_healthkit')
        .maybeSingle();

      return ok({
        permission: availability.available ? 'unknown' : 'unavailable',
        availabilityReason: availability.reason,
        connected: data?.is_connected ?? false,
        lastSyncAt: data?.last_sync_at ?? undefined,
        supportedTypes: [...HEALTH_DATA_TYPES],
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async requestPermissions(): Promise<ServiceResult<HealthPermissionStatus>> {
    try {
      if (Platform.OS !== 'ios') return ok('unavailable');
      const availability = getHealthKitAvailability();
      if (!availability.available) return ok('unavailable');
      const granted = await requestHealthKitAuthorization();
      return ok(granted ? 'authorized' : 'denied');
    } catch (e) {
      return fromError(e);
    }
  },

  /**
   * Sync HealthKit samples into Supabase.
   * @param options.force Bypass the 1-hour throttle (manual pull-to-refresh / settings).
   */
  async sync(
    userId: string,
    sinceDays = 30,
    options?: { force?: boolean },
  ): Promise<ServiceResult<HealthSyncReport>> {
    const key = syncThrottleKey(userId);

    return dedupeInFlight(
      egressKey(['healthSyncRun', userId, sinceDays, options?.force === true]),
      async () => {
        try {
          if (!options?.force) {
            const memoryOk = canRunThrottled(key, HEALTH_SYNC_MIN_INTERVAL_MS);
            if (!memoryOk) {
              recordEgress('health:sync:throttled', { meta: { ageMs: peekThrottleAgeMs(key) } });
              return ok({
                synced: 0,
                dataTypes: [],
                errors: [],
                inserted: 0,
                updated: 0,
                skipped: 0,
                conflicts: 0,
                importedCardio: 0,
                throttled: true,
              });
            }

            const persisted = await readPersistedSyncAt(userId);
            if (persisted != null && Date.now() - persisted < HEALTH_SYNC_MIN_INTERVAL_MS) {
              markThrottle(key);
              recordEgress('health:sync:throttled-persisted', {
                meta: { ageMs: Date.now() - persisted },
              });
              return ok({
                synced: 0,
                dataTypes: [],
                errors: [],
                inserted: 0,
                updated: 0,
                skipped: 0,
                conflicts: 0,
                importedCardio: 0,
                throttled: true,
              });
            }
          }

          const deviceResult = await syncHealthKitFromDevice(sinceDays);
          if (deviceResult.errors.length > 0 && deviceResult.samples.length === 0) {
            return fail(deviceResult.errors.join('; '));
          }

          // Exclude continuous heart_rate from merge/persist even if still present in older builds.
          const deviceSamples = deviceResult.samples.filter(
            (s) => s.dataType !== 'heart_rate' && (SYNC_PERSIST_TYPES as readonly string[]).includes(s.dataType),
          );

          const since = new Date();
          since.setDate(since.getDate() - sinceDays);
          const existing = await fetchExistingSamples(userId, since, {
            dataTypes: SYNC_PERSIST_TYPES,
            limit: 800,
          });
          const { toInsert, toUpdate, result } = mergeHealthSamples(
            existing,
            deviceSamples,
            userId,
            'apple_healthkit',
            'latest_wins',
          );

          const persistedCount = await persistMerged(userId, toInsert, toUpdate);
          const importedCardio = await importHealthKitWorkoutsAsCardio(userId, deviceSamples);

          const latestWeight = deviceSamples
            .filter((s) => s.dataType === 'weight')
            .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
          if (latestWeight && typeof latestWeight.value.kg === 'number') {
            await supabase.from('profiles').update({ weight_kg: latestWeight.value.kg }).eq('id', userId);
          }

          await supabase.from('integration_connections').upsert(
            {
              user_id: userId,
              provider: 'apple_healthkit',
              is_connected: true,
              last_sync_at: new Date().toISOString(),
              sync_status: 'synced',
            },
            { onConflict: 'user_id,provider' },
          );

          try {
            const token = await getAccessToken();
            if (token) {
              await fetch(
                `${process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com'}/api/integrations/health/context/refresh`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ userId }),
                },
              );
            }
          } catch {
            // non-blocking backend refresh
          }

          markThrottle(key);
          await writePersistedSyncAt(userId);
          recordEgress('health:sync:completed', {
            meta: { inserted: toInsert.length, updated: toUpdate.length, importedCardio },
          });

          return ok({
            synced: persistedCount,
            dataTypes: [...new Set(deviceSamples.map((s) => s.dataType))],
            errors: deviceResult.errors,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            conflicts: result.conflicts,
            importedCardio,
          });
        } catch (e) {
          return fromError(e);
        }
      },
    );
  },

  async getDailySummaries(userId: string, days = 14): Promise<ServiceResult<HealthDailySummary[]>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      // Summaries never need continuous HR rows — filter to low-cardinality types.
      const rows = await fetchExistingSamples(userId, since, {
        dataTypes: SUMMARY_TYPES,
        limit: Math.min(800, Math.max(120, days * 40)),
      });
      return ok(summarizeHealthByDay(rows));
    } catch (e) {
      return fromError(e);
    }
  },

  async previewSamples(sinceDays = 7): Promise<HealthMetricSample[]> {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    return fetchHealthKitSamples(since);
  },
};

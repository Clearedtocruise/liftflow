import { Platform } from 'react-native';

import { HEALTH_DATA_LABELS, HEALTH_DATA_TYPES, type HealthPermissionStatus } from '@/integrations/healthConstants';
import {
  fetchHealthKitSamples,
  getHealthKitAvailability,
  requestHealthKitAuthorization,
  syncHealthKitFromDevice,
} from '@/integrations/healthkitProvider';
import type { HealthMetricSample } from '@/integrations/types';
import { mergeHealthSamples, summarizeHealthByDay, type HealthDailySummary, type StoredHealthSample } from '@/lib/healthSyncEngine';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import { supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';
import type { HealthSyncResult } from '@/integrations/types';

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
};

async function fetchExistingSamples(userId: string, since: Date): Promise<StoredHealthSample[]> {
  const { data } = await supabase
    .from('healthkit_sync_records')
    .select('id, user_id, data_type, external_id, value, recorded_at, synced_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .limit(3000);

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

async function persistMerged(userId: string, toInsert: StoredHealthSample[], toUpdate: StoredHealthSample[]): Promise<number> {
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

  async sync(userId: string, sinceDays = 30): Promise<ServiceResult<HealthSyncReport>> {
    try {
      const deviceResult = await syncHealthKitFromDevice(sinceDays);
      if (deviceResult.errors.length > 0 && deviceResult.samples.length === 0) {
        return fail(deviceResult.errors.join('; '));
      }

      const since = new Date();
      since.setDate(since.getDate() - sinceDays);
      const existing = await fetchExistingSamples(userId, since);
      const { toInsert, toUpdate, result } = mergeHealthSamples(
        existing,
        deviceResult.samples,
        userId,
        'apple_healthkit',
        'latest_wins',
      );

      const persisted = await persistMerged(userId, toInsert, toUpdate);

      const latestWeight = deviceResult.samples
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
          await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com'}/api/integrations/health/context/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId }),
          });
        }
      } catch {
        // non-blocking backend refresh
      }

      return ok({
        synced: persisted,
        dataTypes: deviceResult.dataTypes,
        errors: deviceResult.errors,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        conflicts: result.conflicts,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async getDailySummaries(userId: string, days = 14): Promise<ServiceResult<HealthDailySummary[]>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const rows = await fetchExistingSamples(userId, since);
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

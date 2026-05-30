import { Platform } from 'react-native';

import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken, supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';
import type { IntegrationConnection } from '@/types/integrations';

import { fetchHealthConnectSamples, getHealthConnectAvailability, syncHealthConnectFromDevice } from '@/integrations/healthConnectProvider';
import { getHealthKitAvailability, syncHealthKitFromDevice } from '@/integrations/healthkitProvider';
import { disconnectStrava, fetchStravaActivities, startStravaOAuth } from '@/integrations/stravaProvider';
import type { HealthMetricSample, HealthSyncResult, WatchSyncPayload } from '@/integrations/types';
import {
    getWatchAvailability,
    isWorkoutAssistantMessage,
    parseIncomingWatchMessage,
    parseWatchWorkoutMessage,
    requestWatchSync,
} from '@/integrations/watchSyncBridge';
import { watchWorkoutService } from '@/services/watchWorkoutService';

type ConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  is_connected: boolean;
  scopes: string[] | null;
  last_sync_at: string | null;
  sync_status: string;
  created_at: string;
};

function mapConnection(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as IntegrationConnection['provider'],
    isConnected: row.is_connected,
    scopes: row.scopes ?? [],
    lastSyncAt: row.last_sync_at ?? undefined,
    syncStatus: row.sync_status as IntegrationConnection['syncStatus'],
    createdAt: row.created_at,
  };
}

async function persistHealthSamples(userId: string, samples: HealthMetricSample[], provider: string): Promise<number> {
  if (samples.length === 0) return 0;

  const rows = samples.map((s) => ({
    user_id: userId,
    data_type: s.dataType,
    external_id: s.externalId ?? null,
    value: { ...s.value, provider, unit: s.unit },
    recorded_at: s.recordedAt,
  }));

  let inserted = 0;
  for (const row of rows) {
    const { error } = await supabase.from('healthkit_sync_records').insert(row);
    if (!error) inserted += 1;
  }
  return inserted;
}

async function updateConnection(
  userId: string,
  provider: IntegrationConnection['provider'],
  patch: Partial<{ isConnected: boolean; lastSyncAt: string; syncStatus: string }>,
): Promise<void> {
  await supabase.from('integration_connections').upsert(
    {
      user_id: userId,
      provider,
      is_connected: patch.isConnected ?? true,
      last_sync_at: patch.lastSyncAt ?? new Date().toISOString(),
      sync_status: patch.syncStatus ?? 'synced',
    },
    { onConflict: 'user_id,provider' },
  );
}

export const integrationService = {
  async getConnections(userId: string): Promise<ServiceResult<IntegrationConnection[]>> {
    try {
      const { data, error } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('user_id', userId);

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapConnection));
    } catch (e) {
      return fromError(e);
    }
  },

  getHealthKitAvailability,
  getHealthConnectAvailability,
  getWatchAvailability,

  async syncAppleHealth(userId: string, sinceDays = 30): Promise<ServiceResult<HealthSyncResult>> {
    try {
      const deviceResult = await syncHealthKitFromDevice(sinceDays);
      if (deviceResult.errors.length > 0 && deviceResult.samples.length === 0) {
        return fail(deviceResult.errors.join('; '));
      }

      const samples = deviceResult.samples;
      const persisted = await persistHealthSamples(userId, samples, 'apple_healthkit');

      // Sync weight to profile
      const latestWeight = samples.filter((s) => s.dataType === 'weight').sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
      if (latestWeight && typeof latestWeight.value.kg === 'number') {
        await supabase.from('profiles').update({ weight_kg: latestWeight.value.kg }).eq('id', userId);
      }

      await updateConnection(userId, 'apple_healthkit', { isConnected: true, syncStatus: 'synced' });

      return ok({ synced: persisted, dataTypes: deviceResult.dataTypes, errors: deviceResult.errors });
    } catch (e) {
      return fromError(e);
    }
  },

  async syncHealthConnect(userId: string, sinceDays = 30): Promise<ServiceResult<HealthSyncResult>> {
    try {
      const deviceResult = await syncHealthConnectFromDevice(sinceDays);
      if (deviceResult.errors.length > 0 && deviceResult.synced === 0) {
        return fail(deviceResult.errors.join('; '));
      }

      const since = new Date();
      since.setDate(since.getDate() - sinceDays);
      const samples = await fetchHealthConnectSamples(since);
      const persisted = await persistHealthSamples(userId, samples, 'google_fit');

      await updateConnection(userId, 'google_fit', { isConnected: true, syncStatus: 'synced' });

      return ok({ synced: persisted, dataTypes: deviceResult.dataTypes, errors: deviceResult.errors });
    } catch (e) {
      return fromError(e);
    }
  },

  async syncWatchSession(userId: string, payload: WatchSyncPayload): Promise<ServiceResult<{ sessionId: string }>> {
    try {
      const { data, error } = await supabase
        .from('watch_sessions')
        .insert({
          user_id: userId,
          workout_session_id: payload.workoutSessionId ?? null,
          started_at: payload.startedAt,
          ended_at: payload.endedAt ?? null,
          heart_rate_samples: payload.heartRateSamples,
          motion_summary: {
            steps: payload.steps,
            activeCalories: payload.activeCalories,
            distanceMeters: payload.distanceMeters,
            ...payload.motionSummary,
          },
        })
        .select('id')
        .single();

      if (error) return fail(error.message);

      if (payload.heartRateSamples.length > 0) {
        const hrRows = payload.heartRateSamples.map((s) => ({
          user_id: userId,
          session_id: data.id,
          session_type: 'workout',
          recorded_at: s.recordedAt,
          bpm: s.bpm,
          source: 'apple_watch',
        }));
        await supabase.from('heart_rate_samples').insert(hrRows);
      }

      await updateConnection(userId, 'apple_watch', { isConnected: true, syncStatus: 'synced' });
      return ok({ sessionId: data.id });
    } catch (e) {
      return fromError(e);
    }
  },

  async requestWatchSync() {
    return requestWatchSync();
  },

  handleWatchMessage(message: Record<string, unknown>, userId: string) {
    if (isWorkoutAssistantMessage(message)) {
      const workoutMsg = parseWatchWorkoutMessage(message);
      if (workoutMsg && workoutMsg.type !== 'workout_sync') {
        return watchWorkoutService.handleIncomingMessage(userId, workoutMsg);
      }
    }
    const payload = parseIncomingWatchMessage(message);
    if (!payload) return null;
    return this.syncWatchSession(userId, payload);
  },

  async connectStrava(userId: string): Promise<ServiceResult<void>> {
    const result = await startStravaOAuth(userId);
    if (!result.success) return fail(result.error ?? 'Strava connection failed');
    return ok(undefined);
  },

  async syncStrava(userId: string): Promise<ServiceResult<{ imported: number }>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com'}/api/integrations/strava/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        return fail(body.message ?? 'Strava sync failed');
      }

      const data = (await response.json()) as { imported: number };
      await updateConnection(userId, 'strava', { isConnected: true, syncStatus: 'synced' });
      return ok({ imported: data.imported ?? 0 });
    } catch (e) {
      return fromError(e);
    }
  },

  async getStravaActivities(userId: string) {
    try {
      const activities = await fetchStravaActivities(userId);
      return ok(activities);
    } catch (e) {
      return fromError(e);
    }
  },

  async disconnectStrava(userId: string): Promise<ServiceResult<void>> {
    try {
      await disconnectStrava(userId);
      await supabase
        .from('integration_connections')
        .update({ is_connected: false, sync_status: 'pending' })
        .eq('user_id', userId)
        .eq('provider', 'strava');
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  /** Platform-aware health sync */
  async syncHealth(userId: string, sinceDays = 30): Promise<ServiceResult<HealthSyncResult>> {
    if (Platform.OS === 'ios') return this.syncAppleHealth(userId, sinceDays);
    if (Platform.OS === 'android') return this.syncHealthConnect(userId, sinceDays);
    return fail('Health sync is available on iOS and Android only.');
  },
};

import { supabase } from '@/supabase/client';
import type { CardioType, ServiceResult } from '@/types/common';

export type LogCardioPayload = {
  userId: string;
  cardioType: CardioType;
  durationSeconds: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  notes?: string;
  workoutSessionId?: string;
  activityKind?: 'cardio' | 'sport' | 'conditioning' | 'mobility' | 'walk';
  sportId?: string;
  intensity?: 'low' | 'moderate' | 'high';
};

export type CardioSessionRecord = {
  id: string;
  cardioType: CardioType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
};

function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function fail(message: string): ServiceResult<never> {
  return { success: false, error: message };
}

export const cardioService = {
  async logSession(payload: LogCardioPayload): Promise<ServiceResult<CardioSessionRecord>> {
    try {
      const startedAt = new Date().toISOString();
      const endedAt = new Date(Date.now() + payload.durationSeconds * 1000).toISOString();
      const { data, error } = await supabase
        .from('cardio_sessions')
        .insert({
          user_id: payload.userId,
          workout_session_id: payload.workoutSessionId ?? null,
          cardio_type: payload.cardioType,
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: payload.durationSeconds,
          distance_meters: payload.distanceMeters ?? null,
          calories_burned: payload.caloriesBurned ?? null,
          avg_heart_rate: payload.avgHeartRate ?? null,
          notes: payload.notes ?? null,
          metadata: {
            activityKind: payload.activityKind ?? 'cardio',
            sportId: payload.sportId,
            intensity: payload.intensity,
          },
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        cardioType: data.cardio_type as CardioType,
        startedAt: data.started_at,
        endedAt: data.ended_at ?? undefined,
        durationSeconds: data.duration_seconds ?? undefined,
        distanceMeters: data.distance_meters != null ? Number(data.distance_meters) : undefined,
        caloriesBurned: data.calories_burned ?? undefined,
        avgHeartRate: data.avg_heart_rate ?? undefined,
        notes: data.notes ?? undefined,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to log activity');
    }
  },

  async getRecent(userId: string, limit = 10): Promise<ServiceResult<CardioSessionRecord[]>> {
    try {
      const { data, error } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map((row: {
          id: string;
          cardio_type: CardioType;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          calories_burned: number | null;
          avg_heart_rate: number | null;
          notes: string | null;
          metadata: Record<string, unknown> | null;
        }) => ({
          id: row.id,
          cardioType: row.cardio_type as CardioType,
          startedAt: row.started_at,
          endedAt: row.ended_at ?? undefined,
          durationSeconds: row.duration_seconds ?? undefined,
          distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : undefined,
          caloriesBurned: row.calories_burned ?? undefined,
          avgHeartRate: row.avg_heart_rate ?? undefined,
          notes: row.notes ?? undefined,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        })),
      );
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to load activities');
    }
  },
};

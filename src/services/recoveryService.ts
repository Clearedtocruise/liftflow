import { apiClient } from '@/api/client';
import { localDateString } from '@/lib/localDate';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken, supabase } from '@/supabase/client';
import type { DailyRecoveryCheckIn, RecoveryTrendPoint } from '@/types/coaching';
import type { RecoveryStatus, ServiceResult } from '@/types/common';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';

type RecoveryRow = {
  id: string;
  user_id: string;
  check_in_date: string;
  assessed_at: string;
  status: string;
  sleep_hours: number | null;
  sleep_quality_score: number | null;
  energy_score: number | null;
  stress_score: number | null;
  soreness_score: number | null;
  recovery_score: number | null;
  daily_recommendation: string | null;
  recovery_mode_active: boolean | null;
  metadata: { volumeMultiplier?: number; intensityMultiplier?: number } | null;
};

function mapRecovery(row: RecoveryRow): DailyRecoveryCheckIn {
  return {
    id: row.id,
    userId: row.user_id,
    checkInDate: row.check_in_date,
    assessedAt: row.assessed_at,
    status: row.status as RecoveryStatus,
    sleepHours: row.sleep_hours ?? undefined,
    sleepQuality: row.sleep_quality_score ?? undefined,
    energyLevel: row.energy_score ?? undefined,
    stressLevel: row.stress_score ?? undefined,
    sorenessLevel: row.soreness_score ?? undefined,
    recoveryScore: row.recovery_score ?? 0,
    dailyRecommendation: row.daily_recommendation ?? '',
    recoveryModeActive: row.recovery_mode_active ?? false,
    volumeMultiplier: row.metadata?.volumeMultiplier,
    intensityMultiplier: row.metadata?.intensityMultiplier,
  };
}

export const recoveryService = {
  async getToday(userId: string): Promise<ServiceResult<DailyRecoveryCheckIn | null>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.get<RecoveryRow | null>(
        `/api/training/recovery/today?userId=${userId}`,
        token,
      );
      if (remote) return ok(mapRecovery(remote));

      const today = localDateString();
      const { data, error } = await supabase
        .from('recovery_assessments')
        .select('*')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle();

      if (error) return fail(error.message);
      if (!data) return ok(null);
      return ok(mapRecovery(data as RecoveryRow));
    } catch (e) {
      return fromError(e);
    }
  },

  async getTrend(userId: string): Promise<ServiceResult<RecoveryTrendPoint[]>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.get<RecoveryRow[]>(
        `/api/training/recovery/trend?userId=${userId}`,
        token,
      );

      const points: RecoveryTrendPoint[] = (remote ?? []).map((row) => ({
        checkInDate: row.check_in_date,
        recoveryScore: row.recovery_score ?? 0,
        dailyRecommendation: row.daily_recommendation ?? undefined,
        recoveryModeActive: row.recovery_mode_active ?? false,
        status: row.status as RecoveryStatus,
      }));

      return ok(points);
    } catch (e) {
      return fromError(e);
    }
  },

  async submitCheckIn(
    userId: string,
    input: {
      sleepHours?: number;
      sleepQuality?: number;
      energyLevel?: number;
      stressLevel?: number;
      sorenessLevel?: number;
    },
  ): Promise<ServiceResult<DailyRecoveryCheckIn>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.post<RecoveryRow>(
        '/api/training/recovery/check-in',
        { userId, ...input },
        token,
      );
      return ok(mapRecovery(remote));
    } catch (e) {
      return fromError(e);
    }
  },

  async getIntelligence(userId: string): Promise<ServiceResult<RecoveryIntelligenceReport>> {
    try {
      const token = await getAccessToken();
      const report = await apiClient.get<RecoveryIntelligenceReport>(
        `/api/training/recovery/intelligence?userId=${userId}`,
        token,
      );
      return ok(report);
    } catch (e) {
      return fromError(e);
    }
  },
};

import { apiClient } from '@/api/client';
import { fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { WeeklyCoachCheckIn } from '@/types/coaching';
import type { ServiceResult } from '@/types/common';

type WeeklyRow = {
  id: string;
  user_id: string;
  week_start_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  compliance_pct: number | null;
  energy_score: number | null;
  sleep_score: number | null;
  analysis: string | null;
  recommendations: string[] | null;
  created_at: string;
};

function mapWeekly(row: WeeklyRow): WeeklyCoachCheckIn {
  return {
    id: row.id,
    userId: row.user_id,
    weekStartDate: row.week_start_date,
    weightKg: row.weight_kg ?? undefined,
    waistCm: row.waist_cm ?? undefined,
    compliancePct: row.compliance_pct ?? undefined,
    energyScore: row.energy_score ?? undefined,
    sleepScore: row.sleep_score ?? undefined,
    analysis: row.analysis ?? undefined,
    recommendations: row.recommendations ?? [],
    createdAt: row.created_at,
  };
}

export const coachCheckInService = {
  async submit(
    userId: string,
    input: {
      weightKg?: number;
      waistCm?: number;
      compliancePct?: number;
      energyScore?: number;
      sleepScore?: number;
    },
  ): Promise<ServiceResult<WeeklyCoachCheckIn>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.post<WeeklyRow>(
        '/api/training/weekly-check-in',
        { userId, ...input },
        token,
      );
      return ok(mapWeekly(remote));
    } catch (e) {
      return fromError(e);
    }
  },

  async getTrend(userId: string): Promise<ServiceResult<WeeklyCoachCheckIn[]>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.get<WeeklyRow[]>(
        `/api/training/weekly-check-in/trend?userId=${userId}`,
        token,
      );
      return ok((remote ?? []).map(mapWeekly));
    } catch (e) {
      return fromError(e);
    }
  },
};

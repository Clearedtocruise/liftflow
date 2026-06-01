import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken, supabase } from '@/supabase/client';
import type { LimitationType, TrainingLimitation } from '@/types/coaching';
import type { ServiceResult } from '@/types/common';

type LimitationRow = {
  id: string;
  user_id: string;
  limitation_type: string;
  body_area: string;
  severity: number | null;
  pain_score: number | null;
  is_diagnosed: boolean | null;
  description: string | null;
  movement_restrictions: string[] | null;
  affected_movements: string[] | null;
  is_active: boolean | null;
  created_at: string;
};

function mapLimitation(row: LimitationRow): TrainingLimitation {
  return {
    id: row.id,
    userId: row.user_id,
    limitationType: row.limitation_type as LimitationType,
    bodyArea: row.body_area,
    severity: row.severity ?? undefined,
    painScore: row.pain_score ?? undefined,
    isDiagnosed: row.is_diagnosed ?? false,
    description: row.description ?? undefined,
    movementRestrictions: row.movement_restrictions ?? [],
    affectedMovements: row.affected_movements ?? [],
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

export const limitationService = {
  async list(userId: string, activeOnly = true): Promise<ServiceResult<TrainingLimitation[]>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.get<LimitationRow[]>(
        `/api/training/limitations?userId=${userId}&active=${activeOnly}`,
        token,
      );
      return ok((remote ?? []).map(mapLimitation));
    } catch {
      let query = supabase.from('training_limitations').select('*').eq('user_id', userId);
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return fail(error.message);
      return ok((data ?? []).map((row) => mapLimitation(row as LimitationRow)));
    }
  },

  async create(
    userId: string,
    payload: {
      limitationType: LimitationType;
      bodyArea: string;
      severity?: number;
      painScore?: number;
      isDiagnosed?: boolean;
      description?: string;
      affectedMovements?: string[];
      voiceText?: string;
    },
  ): Promise<ServiceResult<TrainingLimitation>> {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.post<LimitationRow>(
        '/api/training/limitations',
        { userId, ...payload },
        token,
      );
      return ok(mapLimitation(remote));
    } catch (e) {
      return fromError(e);
    }
  },

  async resolve(id: string): Promise<ServiceResult<void>> {
    try {
      const token = await getAccessToken();
      await apiClient.request(`/api/training/limitations/${id}`, {
        method: 'PATCH',
        body: { resolved: true },
        token,
      });
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },
};

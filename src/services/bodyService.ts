import { API_BASE_URL } from '@/constants/api';
import { mapBodyRecord, mapProgressPhoto } from '@/lib/db-mappers';
import { resolveProgressPhotos } from '@/lib/progressPhotoUrls';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { uploadProgressPhotoFile } from '@/lib/uploadProgressPhotoFile';
import type { IBodyService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type { PhotoAngle, PhysiqueProjection } from '@/types';

export const bodyService: IBodyService = {
  async recordComposition(userId, record) {
    try {
      const { data, error } = await supabase
        .from('body_composition_records')
        .insert({
          user_id: userId,
          recorded_at: record.recordedAt,
          weight_kg: record.weightKg,
          body_fat_pct: record.bodyFatPct,
          lean_mass_kg: record.leanMassKg,
          waist_cm: record.waistCm,
          chest_cm: record.chestCm,
          hips_cm: record.hipsCm,
          arms_cm: record.armsCm,
          thighs_cm: record.thighsCm,
          estimation_method: record.estimationMethod,
          notes: record.notes,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      if (record.weightKg) {
        await supabase.from('profiles').update({ weight_kg: record.weightKg }).eq('id', userId);
        await supabase.from('user_metrics').insert({
          user_id: userId,
          weight_kg: record.weightKg,
          body_fat_pct: record.bodyFatPct,
          source: 'body_composition',
        });
      }

      return ok(mapBodyRecord(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async getCompositionHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('body_composition_records')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapBodyRecord));
    } catch (e) {
      return fromError(e);
    }
  },

  async uploadProgressPhoto(userId, photo) {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .insert({
          user_id: userId,
          photo_url: photo.photoUrl,
          thumbnail_url: photo.thumbnailUrl,
          angle: photo.angle,
          taken_at: photo.takenAt,
          weight_kg: photo.weightKg,
          notes: photo.notes,
          is_private: photo.isPrivate,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapProgressPhoto(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async getProgressPhotos(userId) {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      if (error) return fail(error.message);
      const photos = (data ?? []).map(mapProgressPhoto);
      return ok(await resolveProgressPhotos(photos));
    } catch (e) {
      return fromError(e);
    }
  },

  async createComparison(userId, comparison) {
    try {
      const { data, error } = await supabase
        .from('photo_comparisons')
        .insert({
          user_id: userId,
          before_photo_id: comparison.beforePhotoId,
          after_photo_id: comparison.afterPhotoId,
          title: comparison.title,
          notes: comparison.notes,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      const [before, after] = await Promise.all([
        supabase.from('progress_photos').select('*').eq('id', comparison.beforePhotoId).single(),
        supabase.from('progress_photos').select('*').eq('id', comparison.afterPhotoId).single(),
      ]);

      return ok({
        id: data.id,
        userId: data.user_id,
        beforePhotoId: data.before_photo_id,
        afterPhotoId: data.after_photo_id,
        beforePhoto: before.data ? mapProgressPhoto(before.data) : undefined,
        afterPhoto: after.data ? mapProgressPhoto(after.data) : undefined,
        title: data.title ?? undefined,
        notes: data.notes ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async estimateBodyFat(userId, photoId: string) {
    try {
      const token = await getAccessToken();
      const { data: photo } = await supabase.from('progress_photos').select('photo_url').eq('id', photoId).single();
      if (!photo) return fail('Photo not found');

      const response = await fetch(`${API_BASE_URL}/api/body/estimate-body-fat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ photoUrl: photo.photo_url, userId, photoId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Body fat estimation failed');
      }

      const result = await response.json();
      if (result.bodyFatPct) {
        await supabase.from('profiles').update({ body_fat_pct: result.bodyFatPct }).eq('id', userId);
      }

      return ok(result);
    } catch (e) {
      return fromError(e);
    }
  },

  async generatePhysiqueProjection(userId, photoId, targetDate: string) {
    try {
      const targetBodyFatPct = parseFloat(targetDate);
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/body/projection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, photoId, targetBodyFatPct }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Projection failed');
      }

      const result = await response.json();

      const { data, error } = await supabase
        .from('physique_projections')
        .insert({
          user_id: userId,
          source_photo_id: photoId,
          projected_image_url: result.projectedImageUrl,
          target_body_fat_pct: targetBodyFatPct,
          ai_model_version: result.modelVersion,
          disclaimer_acknowledged: true,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        sourcePhotoId: data.source_photo_id ?? undefined,
        projectedImageUrl: data.projected_image_url ?? undefined,
        targetDate: data.target_date ?? undefined,
        targetBodyFatPct: data.target_body_fat_pct ?? undefined,
        aiModelVersion: data.ai_model_version ?? undefined,
        disclaimerAcknowledged: data.disclaimer_acknowledged,
        createdAt: data.created_at,
      } satisfies PhysiqueProjection);
    } catch (e) {
      return fromError(e);
    }
  },

  async getProjections(userId) {
    try {
      const { data, error } = await supabase
        .from('physique_projections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              sourcePhotoId: row.source_photo_id ?? undefined,
              projectedImageUrl: row.projected_image_url ?? undefined,
              targetDate: row.target_date ?? undefined,
              targetBodyFatPct: row.target_body_fat_pct ?? undefined,
              aiModelVersion: row.ai_model_version ?? undefined,
              disclaimerAcknowledged: row.disclaimer_acknowledged,
              createdAt: row.created_at,
            }) satisfies PhysiqueProjection,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async uploadFromPicker(userId: string, uri: string, angle: PhotoAngle, weightKg?: number) {
    try {
      const photoUrl = await uploadProgressPhotoFile(userId, uri);
      return this.uploadProgressPhoto(userId, {
        userId,
        photoUrl,
        angle,
        takenAt: new Date().toISOString(),
        weightKg,
        isPrivate: true,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async runTransformation(
    userId: string,
    targetBodyFatPct: number,
    options: { beforePhotoId?: string; currentPhotoId?: string } = {},
  ) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/body/transformation/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, targetBodyFatPct, ...options }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Transformation projection failed');
      }

      const result = await response.json();
      return ok(mapTransformationResponse(userId, result));
    } catch (e) {
      return fromError(e);
    }
  },

  async getLatestTransformation(userId: string) {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/api/body/transformation/latest?userId=${encodeURIComponent(userId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Failed to load transformation');
      }

      const result = await response.json();
      if (!result) return ok(null);
      return ok(mapTransformationResponse(userId, result));
    } catch (e) {
      return fromError(e);
    }
  },

  async getTransformationHistory(userId: string, limit = 10) {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/api/body/transformation/history?userId=${encodeURIComponent(userId)}&limit=${limit}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Failed to load transformation history');
      }

      const result = (await response.json()) as { projections?: Record<string, unknown>[] };
      const rows = result.projections ?? [];
      return ok(rows.map((row) => mapTransformationResponse(userId, row)));
    } catch (e) {
      return fromError(e);
    }
  },
};

function mapTransformationResponse(
  userId: string,
  row: Record<string, unknown>,
): import('@/types/transformation').TransformationProjection {
  return {
    id: String(row.id ?? ''),
    userId,
    beforePhotoId: (row.beforePhotoId as string) ?? undefined,
    currentPhotoId: (row.currentPhotoId as string) ?? undefined,
    beforePhotoUrl: (row.beforePhotoUrl as string) ?? undefined,
    currentPhotoUrl: (row.currentPhotoUrl as string) ?? undefined,
    targetBodyFatPct: Number(row.targetBodyFatPct),
    current: row.current as import('@/types/transformation').BodyCompositionSnapshot,
    projected: row.projected as import('@/types/transformation').BodyCompositionSnapshot,
    projectedWeeksToTarget:
      row.projectedWeeksToTarget != null ? Number(row.projectedWeeksToTarget) : undefined,
    successScore: row.successScore != null ? Number(row.successScore) : undefined,
    workoutAdherencePct: row.workoutAdherencePct != null ? Number(row.workoutAdherencePct) : undefined,
    nutritionAdherencePct: row.nutritionAdherencePct != null ? Number(row.nutritionAdherencePct) : undefined,
    weightTrend: (row.weightTrend as string) ?? undefined,
    rationale: String(row.rationale ?? ''),
    confidence: (row.confidence as import('@/types/transformation').TransformationConfidence) ?? 'medium',
    engineVersion: String(row.engineVersion ?? 'transformation-v1'),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

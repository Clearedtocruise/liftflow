import { inferWeightTrend } from './nutritionIntelligenceEngine.js';
import { computeAdherence, getUserOutcomeSummary } from './outcomeEngine.js';
import { requireAdmin } from './supabase.js';

export const TRANSFORMATION_ENGINE_VERSION = 'transformation-v1';
export const TRANSFORMATION_BF_PRESETS = [20, 15, 12, 10] as const;

export type BodyCompositionSnapshot = {
  weightKg: number;
  bodyFatPct: number;
  leanMassKg: number;
  fatMassKg: number;
};

export type TransformationProjectionResult = {
  id?: string;
  userId?: string;
  beforePhotoId?: string;
  currentPhotoId?: string;
  beforePhotoUrl?: string;
  currentPhotoUrl?: string;
  targetBodyFatPct: number;
  current: BodyCompositionSnapshot;
  projected: BodyCompositionSnapshot;
  projectedWeeksToTarget?: number;
  successScore?: number;
  workoutAdherencePct?: number;
  nutritionAdherencePct?: number;
  weightTrend?: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  engineVersion: string;
  createdAt?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBodyComposition(weightKg: number, bodyFatPct: number): BodyCompositionSnapshot {
  const fatMassKg = round2(weightKg * (bodyFatPct / 100));
  const leanMassKg = round2(weightKg - fatMassKg);
  return { weightKg: round2(weightKg), bodyFatPct: round2(bodyFatPct), leanMassKg, fatMassKg };
}

/** Hold lean mass constant — standard physique projection model. */
export function projectToTargetBodyFat(
  currentWeightKg: number,
  currentBodyFatPct: number,
  targetBodyFatPct: number,
): BodyCompositionSnapshot {
  const current = computeBodyComposition(currentWeightKg, currentBodyFatPct);
  const safeTarget = Math.min(Math.max(targetBodyFatPct, 5), 45);
  const projectedWeightKg = round2(current.leanMassKg / (1 - safeTarget / 100));
  return computeBodyComposition(projectedWeightKg, safeTarget);
}

export function estimateWeeksToTarget(params: {
  currentBodyFatPct: number;
  targetBodyFatPct: number;
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
}): number | undefined {
  if (params.targetBodyFatPct >= params.currentBodyFatPct - 0.5) return undefined;
  const bfDelta = params.currentBodyFatPct - params.targetBodyFatPct;
  const adherenceFactor = (params.workoutAdherencePct + params.nutritionAdherencePct) / 200;
  const weeklyBfDrop = 0.25 * Math.max(0.35, Math.min(1, adherenceFactor));
  return round2(bfDelta / weeklyBfDrop);
}

export function buildTransformationRationale(params: {
  targetBodyFatPct: number;
  current: BodyCompositionSnapshot;
  projected: BodyCompositionSnapshot;
  weightTrend?: string;
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
  successScore?: number;
  projectedWeeksToTarget?: number;
}): string {
  const parts: string[] = [
    `At ${params.targetBodyFatPct}% body fat you'd weigh about ${params.projected.weightKg} kg with ${params.projected.leanMassKg} kg lean mass.`,
  ];
  if (params.weightTrend && params.weightTrend !== 'unknown') {
    parts.push(`Weight trend: ${params.weightTrend.replace(/_/g, ' ')}.`);
  }
  parts.push(
    `Adherence: training ${Math.round(params.workoutAdherencePct)}%, nutrition ${Math.round(params.nutritionAdherencePct)}%.`,
  );
  if (params.successScore != null) parts.push(`Success score ${Math.round(params.successScore)}.`);
  if (params.projectedWeeksToTarget != null) {
    parts.push(`Estimated timeline ~${params.projectedWeeksToTarget} weeks at current adherence.`);
  }
  parts.push('Projection assumes lean mass maintained — not medical advice.');
  return parts.join(' ');
}

function resolveConfidence(hasPhotos: boolean, hasWeight: boolean, hasBf: boolean): 'high' | 'medium' | 'low' {
  if (hasPhotos && hasWeight && hasBf) return 'high';
  if (hasWeight && hasBf) return 'medium';
  return 'low';
}

type PhotoRow = { id: string; photo_url: string; taken_at: string };

export async function runTransformationProjection(
  userId: string,
  targetBodyFatPct: number,
  options: { beforePhotoId?: string; currentPhotoId?: string } = {},
): Promise<TransformationProjectionResult> {
  const db = requireAdmin();
  const safeTarget = Math.min(Math.max(targetBodyFatPct, 5), 45);

  const [profileRes, photosRes, bodyRes, outcome, adherence] = await Promise.all([
    db.from('profiles').select('weight_kg, body_fat_pct').eq('id', userId).single(),
    db.from('progress_photos').select('id, photo_url, taken_at').eq('user_id', userId).order('taken_at', { ascending: true }),
    db
      .from('body_composition_records')
      .select('weight_kg, body_fat_pct, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(12),
    getUserOutcomeSummary(userId),
    computeAdherence(userId, 28),
  ]);

  const photos = (photosRes.data ?? []) as PhotoRow[];
  const beforePhoto = options.beforePhotoId
    ? photos.find((p) => p.id === options.beforePhotoId)
    : photos[0];
  const currentPhoto = options.currentPhotoId
    ? photos.find((p) => p.id === options.currentPhotoId)
    : photos[photos.length - 1];

  const latestBody = bodyRes.data?.[0];
  const weightKg =
    Number(latestBody?.weight_kg ?? profileRes.data?.weight_kg ?? 0) || 75;
  let bodyFatPct =
    Number(latestBody?.body_fat_pct ?? profileRes.data?.body_fat_pct ?? 0) || 18;

  const weightSamples = (bodyRes.data ?? [])
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ weightKg: Number(r.weight_kg), recordedAt: r.recorded_at as string }));
  const weightTrend = inferWeightTrend(weightSamples).trend;

  const successScore = outcome.successScore?.overall_score
    ? Number(outcome.successScore.overall_score)
    : undefined;

  const current = computeBodyComposition(weightKg, bodyFatPct);
  const projected = projectToTargetBodyFat(weightKg, bodyFatPct, safeTarget);
  const projectedWeeksToTarget = estimateWeeksToTarget({
    currentBodyFatPct: bodyFatPct,
    targetBodyFatPct: safeTarget,
    workoutAdherencePct: adherence.workoutAdherencePct,
    nutritionAdherencePct: adherence.nutritionAdherencePct,
  });

  const rationale = buildTransformationRationale({
    targetBodyFatPct: safeTarget,
    current,
    projected,
    weightTrend,
    workoutAdherencePct: adherence.workoutAdherencePct,
    nutritionAdherencePct: adherence.nutritionAdherencePct,
    successScore,
    projectedWeeksToTarget,
  });

  const confidence = resolveConfidence(
    Boolean(beforePhoto && currentPhoto),
    weightKg > 0,
    bodyFatPct > 0,
  );

  const { data: inserted, error } = await db
    .from('transformation_projections')
    .insert({
      user_id: userId,
      before_photo_id: beforePhoto?.id ?? null,
      current_photo_id: currentPhoto?.id ?? null,
      target_body_fat_pct: safeTarget,
      current_weight_kg: current.weightKg,
      current_body_fat_pct: current.bodyFatPct,
      current_lean_mass_kg: current.leanMassKg,
      current_fat_mass_kg: current.fatMassKg,
      projected_weight_kg: projected.weightKg,
      projected_body_fat_pct: projected.bodyFatPct,
      projected_lean_mass_kg: projected.leanMassKg,
      projected_fat_mass_kg: projected.fatMassKg,
      projected_weeks_to_target: projectedWeeksToTarget ?? null,
      success_score: successScore ?? null,
      workout_adherence_pct: adherence.workoutAdherencePct,
      nutrition_adherence_pct: adherence.nutritionAdherencePct,
      weight_trend: weightTrend,
      rationale,
      confidence,
      engine_version: TRANSFORMATION_ENGINE_VERSION,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: String(inserted.id),
    userId,
    ...mapTransformationRow(inserted as Record<string, unknown>, {
      beforePhotoUrl: beforePhoto?.photo_url,
      currentPhotoUrl: currentPhoto?.photo_url,
    }),
  };
}

export function mapTransformationRow(
  row: Record<string, unknown>,
  urls: { beforePhotoUrl?: string; currentPhotoUrl?: string } = {},
): TransformationProjectionResult {
  const current: BodyCompositionSnapshot = {
    weightKg: Number(row.current_weight_kg ?? 0),
    bodyFatPct: Number(row.current_body_fat_pct ?? 0),
    leanMassKg: Number(row.current_lean_mass_kg ?? 0),
    fatMassKg: Number(row.current_fat_mass_kg ?? 0),
  };
  const projected: BodyCompositionSnapshot = {
    weightKg: Number(row.projected_weight_kg ?? 0),
    bodyFatPct: Number(row.projected_body_fat_pct ?? 0),
    leanMassKg: Number(row.projected_lean_mass_kg ?? 0),
    fatMassKg: Number(row.projected_fat_mass_kg ?? 0),
  };

  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    beforePhotoId: (row.before_photo_id as string) ?? undefined,
    currentPhotoId: (row.current_photo_id as string) ?? undefined,
    beforePhotoUrl: urls.beforePhotoUrl,
    currentPhotoUrl: urls.currentPhotoUrl,
    targetBodyFatPct: Number(row.target_body_fat_pct),
    current,
    projected,
    projectedWeeksToTarget: row.projected_weeks_to_target != null ? Number(row.projected_weeks_to_target) : undefined,
    successScore: row.success_score != null ? Number(row.success_score) : undefined,
    workoutAdherencePct: row.workout_adherence_pct != null ? Number(row.workout_adherence_pct) : undefined,
    nutritionAdherencePct: row.nutrition_adherence_pct != null ? Number(row.nutrition_adherence_pct) : undefined,
    weightTrend: (row.weight_trend as string) ?? undefined,
    rationale: String(row.rationale ?? ''),
    confidence: (row.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    engineVersion: String(row.engine_version ?? TRANSFORMATION_ENGINE_VERSION),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function getLatestTransformationProjection(userId: string): Promise<TransformationProjectionResult | null> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('transformation_projections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const photoIds = [data.before_photo_id, data.current_photo_id].filter(Boolean) as string[];
  let beforePhotoUrl: string | undefined;
  let currentPhotoUrl: string | undefined;

  if (photoIds.length > 0) {
    const { data: photos } = await db.from('progress_photos').select('id, photo_url').in('id', photoIds);
    beforePhotoUrl = photos?.find((p) => p.id === data.before_photo_id)?.photo_url;
    currentPhotoUrl = photos?.find((p) => p.id === data.current_photo_id)?.photo_url;
  }

  return mapTransformationRow(data as Record<string, unknown>, { beforePhotoUrl, currentPhotoUrl });
}

export async function listTransformationProjections(userId: string, limit = 10): Promise<TransformationProjectionResult[]> {
  const db = requireAdmin();
  const { data, error } = await db
    .from('transformation_projections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTransformationRow(row as Record<string, unknown>));
}

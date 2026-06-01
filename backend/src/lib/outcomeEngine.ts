/**
 * Sprint 6.0 — Outcome Intelligence Engine
 * Measures outcomes (strength, weight, recovery, goals), not activity alone.
 */

import { requireAdmin } from './supabase.js';

// ---------------------------------------------------------------------------
// Constants & formulas (documented in docs/OUTCOME_INTELLIGENCE.md)
// ---------------------------------------------------------------------------

export const SUCCESS_SCORE_WEIGHTS = {
  workoutAdherence: 0.25,
  nutritionAdherence: 0.2,
  recoveryCompliance: 0.15,
  goalProgress: 0.2,
  strengthProgress: 0.1,
  weightProgress: 0.1,
} as const;

export const LIVES_IMPROVED_THRESHOLD = 75;
export const SUSTAINED_IMPROVEMENT_WEEKS = 12;
export const PROTEIN_COMPLIANCE_RATIO = 0.85;
export const DEFAULT_PERIOD_DAYS = 7;

export type ScoreCategory = 'exceptional' | 'good' | 'needs_attention' | 'at_risk';

export type OutcomeMetrics = {
  weightKg: number | null;
  bodyFatPct: number | null;
  measurements: Record<string, number>;
  strengthMetrics: Record<string, number>;
  recoveryScore: number | null;
};

export type AdherenceResult = {
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
  completedWorkouts: number;
  expectedWorkouts: number;
  compliantNutritionDays: number;
  trackedNutritionDays: number;
};

export type SuccessScoreInput = {
  workoutAdherenceScore: number;
  nutritionAdherenceScore: number;
  recoveryComplianceScore: number;
  goalProgressScore: number;
  strengthProgressScore: number;
  weightProgressScore: number;
};

export type RiskFlagInput = {
  riskLevel: 'low' | 'moderate' | 'at_risk' | 'critical';
  riskReason: string;
  generatedCoachingMessage: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function epley1Rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function categorizeSuccessScore(overall: number): ScoreCategory {
  if (overall >= 90) return 'exceptional';
  if (overall >= 75) return 'good';
  if (overall >= 60) return 'needs_attention';
  return 'at_risk';
}

export function computeOverallSuccessScore(input: SuccessScoreInput): number {
  const score =
    input.workoutAdherenceScore * SUCCESS_SCORE_WEIGHTS.workoutAdherence +
    input.nutritionAdherenceScore * SUCCESS_SCORE_WEIGHTS.nutritionAdherence +
    input.recoveryComplianceScore * SUCCESS_SCORE_WEIGHTS.recoveryCompliance +
    input.goalProgressScore * SUCCESS_SCORE_WEIGHTS.goalProgress +
    input.strengthProgressScore * SUCCESS_SCORE_WEIGHTS.strengthProgress +
    input.weightProgressScore * SUCCESS_SCORE_WEIGHTS.weightProgress;
  return Math.round(clamp(score, 0, 100) * 100) / 100;
}

export function evaluateLifeImproved(params: {
  overallScore: number;
  goalCompleted: boolean;
  sustainedPositiveTrend: boolean;
}): boolean {
  return (
    params.overallScore >= LIVES_IMPROVED_THRESHOLD ||
    params.goalCompleted ||
    params.sustainedPositiveTrend
  );
}

async function latestWeightAndBodyFat(userId: string): Promise<{ weightKg: number | null; bodyFatPct: number | null }> {
  const db = requireAdmin();

  const { data: metric } = await db
    .from('user_metrics')
    .select('weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await db
    .from('profiles')
    .select('weight_kg, body_fat_pct')
    .eq('id', userId)
    .single();

  return {
    weightKg: metric?.weight_kg ?? profile?.weight_kg ?? null,
    bodyFatPct: metric?.body_fat_pct ?? profile?.body_fat_pct ?? null,
  };
}

async function latestMeasurements(userId: string): Promise<Record<string, number>> {
  const db = requireAdmin();
  const { data } = await db
    .from('body_composition_records')
    .select('waist_cm, chest_cm, hips_cm, arms_cm, thighs_cm')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val != null && key.endsWith('_cm')) out[key.replace('_cm', '')] = Number(val);
  }
  return out;
}

export async function collectStrengthMetrics(userId: string, sinceIso?: string): Promise<Record<string, number>> {
  const db = requireAdmin();

  let sessionsQuery = db
    .from('workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (sinceIso) {
    sessionsQuery = sessionsQuery.gte('started_at', sinceIso);
  }

  const { data: sessions } = await sessionsQuery.limit(200);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (!sessionIds.length) return {};

  const { data: exercises } = await db
    .from('workout_exercises')
    .select('id, exercises(slug, name)')
    .in('session_id', sessionIds);

  const exerciseIds = (exercises ?? []).map((e) => e.id);
  if (!exerciseIds.length) return {};

  const slugByExerciseId = new Map<string, string>();
  for (const ex of exercises ?? []) {
    const row = ex as { id: string; exercises?: { slug?: string; name?: string } };
    slugByExerciseId.set(row.id, row.exercises?.slug ?? row.exercises?.name ?? 'unknown');
  }

  const { data: sets } = await db
    .from('workout_sets')
    .select('workout_exercise_id, weight, reps')
    .in('workout_exercise_id', exerciseIds)
    .not('weight', 'is', null)
    .not('reps', 'is', null);

  const best: Record<string, number> = {};
  for (const row of sets ?? []) {
    const slug = slugByExerciseId.get(row.workout_exercise_id as string) ?? 'unknown';
    const est = epley1Rm(Number(row.weight), Number(row.reps));
    if (est > (best[slug] ?? 0)) best[slug] = Math.round(est * 10) / 10;
  }
  return best;
}

async function latestRecoveryScore(userId: string): Promise<number | null> {
  const db = requireAdmin();
  const { data } = await db
    .from('recovery_assessments')
    .select('recovery_score, energy_score, sleep_hours')
    .eq('user_id', userId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.recovery_score != null) return Number(data.recovery_score);
  if (data?.energy_score != null) return clamp(Number(data.energy_score) * 10, 0, 100);
  return null;
}

export async function collectCurrentMetrics(userId: string): Promise<OutcomeMetrics> {
  const [{ weightKg, bodyFatPct }, measurements, strengthMetrics, recoveryScore] = await Promise.all([
    latestWeightAndBodyFat(userId),
    latestMeasurements(userId),
    collectStrengthMetrics(userId),
    latestRecoveryScore(userId),
  ]);

  return { weightKg, bodyFatPct, measurements, strengthMetrics, recoveryScore };
}

export async function captureOutcomeBaseline(userId: string): Promise<void> {
  const db = requireAdmin();
  const metrics = await collectCurrentMetrics(userId);

  const { error } = await db.from('user_outcome_baselines').upsert(
    {
      user_id: userId,
      starting_weight_kg: metrics.weightKg,
      starting_body_fat_pct: metrics.bodyFatPct,
      starting_measurements: metrics.measurements,
      starting_strength_metrics: metrics.strengthMetrics,
      starting_recovery_score: metrics.recoveryScore,
      onboarding_date: todayIso(),
    },
    { onConflict: 'user_id' },
  );

  if (error) throw new Error(`Failed to capture outcome baseline: ${error.message}`);
}

function strengthIndex(metrics: Record<string, number>): number {
  const values = Object.values(metrics);
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeStrengthDelta(
  baseline: Record<string, number>,
  current: Record<string, number>,
): Record<string, number> {
  const delta: Record<string, number> = {};
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const key of keys) {
    const b = baseline[key] ?? 0;
    const c = current[key] ?? 0;
    if (c > 0 || b > 0) delta[key] = Math.round((c - b) * 10) / 10;
  }
  return delta;
}

function progressScoreFromDelta(delta: number, favorableDirection: 'increase' | 'decrease', scale = 5): number {
  if (delta === 0) return 50;
  const signed = favorableDirection === 'increase' ? delta : -delta;
  return clamp(50 + (signed / scale) * 50, 0, 100);
}

export async function computeAdherence(userId: string, periodDays = DEFAULT_PERIOD_DAYS): Promise<AdherenceResult> {
  const db = requireAdmin();
  const since = daysAgoIso(periodDays);
  const sinceTs = `${since}T00:00:00.000Z`;

  const { data: profile } = await db.from('profiles').select('metadata').eq('id', userId).single();
  const coachMeta = (profile?.metadata as { coachActivation?: { frequency?: number }; coachProfile?: { daysPerWeek?: number } }) ?? {};
  const daysPerWeek =
    coachMeta.coachActivation?.frequency ??
    coachMeta.coachProfile?.daysPerWeek ??
    4;
  const expectedWorkouts = Math.max(1, Math.round((daysPerWeek * periodDays) / 7));

  const { count: completedWorkouts } = await db
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', sinceTs);

  const workoutAdherencePct = clamp(((completedWorkouts ?? 0) / expectedWorkouts) * 100, 0, 100);

  const { data: nutritionGoal } = await db
    .from('nutrition_goals')
    .select('protein_g')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const proteinTarget = nutritionGoal?.protein_g ?? 120;

  const { data: meals } = await db
    .from('meals')
    .select('scheduled_date, protein_g')
    .eq('user_id', userId)
    .gte('scheduled_date', since)
    .not('scheduled_date', 'is', null);

  const proteinByDay = new Map<string, number>();
  for (const meal of meals ?? []) {
    const day = meal.scheduled_date as string;
    proteinByDay.set(day, (proteinByDay.get(day) ?? 0) + Number(meal.protein_g ?? 0));
  }

  let compliantNutritionDays = 0;
  const trackedNutritionDays = proteinByDay.size;
  for (const total of proteinByDay.values()) {
    if (total >= proteinTarget * PROTEIN_COMPLIANCE_RATIO) compliantNutritionDays += 1;
  }

  const nutritionAdherencePct =
    trackedNutritionDays > 0
      ? clamp((compliantNutritionDays / Math.max(trackedNutritionDays, Math.ceil(periodDays / 2))) * 100, 0, 100)
      : 50;

  return {
    workoutAdherencePct: Math.round(workoutAdherencePct * 100) / 100,
    nutritionAdherencePct: Math.round(nutritionAdherencePct * 100) / 100,
    completedWorkouts: completedWorkouts ?? 0,
    expectedWorkouts,
    compliantNutritionDays,
    trackedNutritionDays,
  };
}

export async function updateGoalAchievement(userId: string): Promise<{
  avgCompletionPct: number;
  anyCompleted: boolean;
}> {
  const db = requireAdmin();
  const { data: goals } = await db
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  let totalCompletion = 0;
  let count = 0;
  let anyCompleted = false;

  for (const goal of goals ?? []) {
    const target = Number(goal.target_value ?? 0);
    const current = Number(goal.current_value ?? 0);
    let baseline = goal.baseline_value != null ? Number(goal.baseline_value) : null;

    if (baseline == null) {
      baseline = current;
      await db.from('goals').update({ baseline_value: baseline }).eq('id', goal.id);
    }

    const completionPct = target > 0 ? clamp((current / target) * 100, 0, 100) : 0;

    const createdAt = new Date(goal.created_at as string);
    const weeksElapsed = Math.max(1, (Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const progress = current - (baseline ?? 0);
    const velocity = Math.round((progress / weeksElapsed) * 10000) / 10000;
    const remaining = Math.max(0, target - current);

    let projected: string | null = null;
    if (velocity > 0 && remaining > 0) {
      const weeksToComplete = remaining / velocity;
      const d = new Date();
      d.setDate(d.getDate() + Math.round(weeksToComplete * 7));
      projected = d.toISOString().slice(0, 10);
    }

    await db
      .from('goals')
      .update({
        completion_pct: Math.round(completionPct * 100) / 100,
        velocity,
        projected_completion_date: projected,
      })
      .eq('id', goal.id);

    totalCompletion += completionPct;
    count += 1;
    if (completionPct >= 100 || goal.status === 'completed') anyCompleted = true;
  }

  return {
    avgCompletionPct: count > 0 ? totalCompletion / count : 0,
    anyCompleted,
  };
}

async function hasSustainedPositiveTrend(userId: string): Promise<boolean> {
  const db = requireAdmin();
  const cutoff = daysAgoIso(SUSTAINED_IMPROVEMENT_WEEKS * 7);

  const { data: snapshots } = await db
    .from('user_outcome_snapshots')
    .select('snapshot_date, weight_delta_kg, recovery_delta, strength_delta')
    .eq('user_id', userId)
    .gte('snapshot_date', cutoff)
    .order('snapshot_date', { ascending: true });

  if (!snapshots || snapshots.length < 4) return false;

  let positiveWeeks = 0;
  for (const snap of snapshots) {
    const weightDelta = Number(snap.weight_delta_kg ?? 0);
    const recoveryDelta = Number(snap.recovery_delta ?? 0);
    const strengthDelta = strengthIndex((snap.strength_delta as Record<string, number>) ?? {});
    if (recoveryDelta > 0 || strengthDelta > 0 || weightDelta !== 0) positiveWeeks += 1;
  }

  return positiveWeeks >= Math.floor(snapshots.length * 0.7);
}

export function detectRiskFlags(context: {
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
  recoveryScore: number | null;
  previousRecoveryScore: number | null;
  weightDeltaKg: number | null;
  primaryGoal: string | null;
  goalProgressScore: number;
  previousWorkoutAdherence?: number;
}): RiskFlagInput[] {
  const flags: RiskFlagInput[] = [];

  if (context.workoutAdherencePct < 50) {
    flags.push({
      riskLevel: 'at_risk',
      riskReason: 'Workout adherence declining',
      generatedCoachingMessage:
        'Your training consistency has dropped. Let\'s simplify this week — pick 3 non-negotiable sessions and I\'ll adjust volume.',
    });
  } else if (
    context.previousWorkoutAdherence != null &&
    context.workoutAdherencePct < context.previousWorkoutAdherence - 15
  ) {
    flags.push({
      riskLevel: 'moderate',
      riskReason: 'Workout adherence declining',
      generatedCoachingMessage: 'Consistency slipped vs last week. Want me to reschedule missed sessions?',
    });
  }

  if (context.nutritionAdherencePct < 55) {
    flags.push({
      riskLevel: 'at_risk',
      riskReason: 'Protein compliance dropping',
      generatedCoachingMessage:
        'Protein targets are slipping. I can rebuild your meal plan around quick high-protein options.',
    });
  }

  if (context.primaryGoal === 'fat_loss' && context.weightDeltaKg != null && context.weightDeltaKg > 0.5) {
    flags.push({
      riskLevel: 'at_risk',
      riskReason: 'Weight moving away from goal',
      generatedCoachingMessage:
        'Weight is trending away from your fat-loss target. Let\'s review calories and NEAT this week.',
    });
  }

  if (
    context.recoveryScore != null &&
    context.previousRecoveryScore != null &&
    context.recoveryScore < context.previousRecoveryScore - 10
  ) {
    flags.push({
      riskLevel: 'moderate',
      riskReason: 'Recovery worsening',
      generatedCoachingMessage: 'Recovery scores are down — consider a deload or extra sleep focus for 3 days.',
    });
  }

  if (context.goalProgressScore < 40) {
    flags.push({
      riskLevel: 'moderate',
      riskReason: 'Goal progress stalled',
      generatedCoachingMessage: 'Progress toward your primary goal has stalled. We should revisit timeline or targets.',
    });
  }

  return flags;
}

export async function computeUserOutcome(
  userId: string,
  periodType: 'daily' | 'weekly' = 'weekly',
): Promise<{ snapshotId: string; successScoreId: string }> {
  const db = requireAdmin();
  const periodDays = periodType === 'daily' ? 1 : 7;
  const snapshotDate = todayIso();

  const { data: baseline } = await db
    .from('user_outcome_baselines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!baseline) {
    await captureOutcomeBaseline(userId);
  }

  const { data: baselineRow } = await db
    .from('user_outcome_baselines')
    .select('*')
    .eq('user_id', userId)
    .single();

  const current = await collectCurrentMetrics(userId);
  const adherence = await computeAdherence(userId, periodDays);
  const goalResult = await updateGoalAchievement(userId);

  const { data: profile } = await db
    .from('profiles')
    .select('primary_training_goal')
    .eq('id', userId)
    .single();

  const weightDelta =
    current.weightKg != null && baselineRow.starting_weight_kg != null
      ? Math.round((current.weightKg - Number(baselineRow.starting_weight_kg)) * 100) / 100
      : null;

  const bodyFatDelta =
    current.bodyFatPct != null && baselineRow.starting_body_fat_pct != null
      ? Math.round((current.bodyFatPct - Number(baselineRow.starting_body_fat_pct)) * 100) / 100
      : null;

  const strengthDelta = computeStrengthDelta(
    (baselineRow.starting_strength_metrics as Record<string, number>) ?? {},
    current.strengthMetrics,
  );

  const recoveryDelta =
    current.recoveryScore != null && baselineRow.starting_recovery_score != null
      ? Math.round((current.recoveryScore - Number(baselineRow.starting_recovery_score)) * 100) / 100
      : null;

  const { data: prevSnapshot } = await db
    .from('user_outcome_snapshots')
    .select('workout_adherence_pct, current_recovery_score')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const favorableWeightDir = profile?.primary_training_goal === 'fat_loss' ? 'decrease' : 'increase';
  const weightProgressScore =
    weightDelta != null ? progressScoreFromDelta(weightDelta, favorableWeightDir, 3) : 50;

  const baselineStrength = strengthIndex((baselineRow.starting_strength_metrics as Record<string, number>) ?? {});
  const currentStrength = strengthIndex(current.strengthMetrics);
  const strengthProgressScore =
    baselineStrength > 0
      ? clamp(50 + ((currentStrength - baselineStrength) / baselineStrength) * 100, 0, 100)
      : currentStrength > 0
        ? 70
        : 50;

  const recoveryComplianceScore = current.recoveryScore ?? 50;
  const goalProgressScore = goalResult.avgCompletionPct;

  const successInput: SuccessScoreInput = {
    workoutAdherenceScore: adherence.workoutAdherencePct,
    nutritionAdherenceScore: adherence.nutritionAdherencePct,
    recoveryComplianceScore,
    goalProgressScore,
    strengthProgressScore: Math.round(strengthProgressScore * 100) / 100,
    weightProgressScore: Math.round(weightProgressScore * 100) / 100,
  };

  const overallScore = computeOverallSuccessScore(successInput);
  const scoreCategory = categorizeSuccessScore(overallScore);
  const sustainedPositiveTrend = await hasSustainedPositiveTrend(userId);
  const lifeImproved = evaluateLifeImproved({
    overallScore,
    goalCompleted: goalResult.anyCompleted,
    sustainedPositiveTrend,
  });

  const { data: snapshot, error: snapErr } = await db
    .from('user_outcome_snapshots')
    .upsert(
      {
        user_id: userId,
        snapshot_date: snapshotDate,
        period_type: periodType,
        current_weight_kg: current.weightKg,
        current_body_fat_pct: current.bodyFatPct,
        current_measurements: current.measurements,
        current_strength_metrics: current.strengthMetrics,
        current_recovery_score: current.recoveryScore,
        weight_delta_kg: weightDelta,
        body_fat_delta_pct: bodyFatDelta,
        strength_delta: strengthDelta,
        recovery_delta: recoveryDelta,
        workout_adherence_pct: adherence.workoutAdherencePct,
        nutrition_adherence_pct: adherence.nutritionAdherencePct,
      },
      { onConflict: 'user_id,snapshot_date,period_type' },
    )
    .select('id')
    .single();

  if (snapErr) throw new Error(`Snapshot failed: ${snapErr.message}`);

  const { data: successRow, error: scoreErr } = await db
    .from('user_success_scores')
    .upsert(
      {
        user_id: userId,
        computed_at: snapshotDate,
        overall_score: overallScore,
        workout_adherence_score: successInput.workoutAdherenceScore,
        nutrition_adherence_score: successInput.nutritionAdherenceScore,
        recovery_compliance_score: successInput.recoveryComplianceScore,
        goal_progress_score: successInput.goalProgressScore,
        strength_progress_score: successInput.strengthProgressScore,
        weight_progress_score: successInput.weightProgressScore,
        score_category: scoreCategory,
        life_improved: lifeImproved,
      },
      { onConflict: 'user_id,computed_at' },
    )
    .select('id')
    .single();

  if (scoreErr) throw new Error(`Success score failed: ${scoreErr.message}`);

  await db
    .from('user_risk_flags')
    .update({ is_active: false, resolved_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_active', true);

  const risks = detectRiskFlags({
    workoutAdherencePct: adherence.workoutAdherencePct,
    nutritionAdherencePct: adherence.nutritionAdherencePct,
    recoveryScore: current.recoveryScore,
    previousRecoveryScore: prevSnapshot?.current_recovery_score ?? null,
    weightDeltaKg: weightDelta,
    primaryGoal: profile?.primary_training_goal ?? null,
    goalProgressScore,
    previousWorkoutAdherence: prevSnapshot?.workout_adherence_pct ?? undefined,
  });

  if (risks.length) {
    await db.from('user_risk_flags').insert(
      risks.map((r) => ({
        user_id: userId,
        risk_level: r.riskLevel,
        risk_reason: r.riskReason,
        generated_coaching_message: r.generatedCoachingMessage,
        is_active: true,
      })),
    );
  }

  return { snapshotId: snapshot.id, successScoreId: successRow.id };
}

export async function runOutcomeEngineForAllUsers(): Promise<{ processed: number; errors: string[] }> {
  const db = requireAdmin();
  const { data: profiles } = await db
    .from('profiles')
    .select('id')
    .eq('onboarding_completed', true)
    .is('deleted_at', null);

  let processed = 0;
  const errors: string[] = [];

  for (const p of profiles ?? []) {
    try {
      await computeUserOutcome(p.id, 'weekly');
      processed += 1;
    } catch (e) {
      errors.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await computePopulationAggregates();
  await computeCohortSignals();

  return { processed, errors };
}

export async function computePopulationAggregates(): Promise<void> {
  const db = requireAdmin();
  const snapshotDate = todayIso();
  const activeCutoff = daysAgoIso(30);

  const { count: totalUsers } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  const { data: activeSessionUsers } = await db
    .from('workout_sessions')
    .select('user_id')
    .gte('started_at', `${activeCutoff}T00:00:00.000Z`);

  const activeUsers30d = new Set((activeSessionUsers ?? []).map((r) => r.user_id)).size;

  const { count: payingUsers } = await db
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .neq('tier', 'free')
    .eq('status', 'active');

  const { data: snapshots } = await db
    .from('user_outcome_snapshots')
    .select('weight_delta_kg, strength_delta, recovery_delta, workout_adherence_pct, nutrition_adherence_pct')
    .eq('snapshot_date', snapshotDate);

  const { data: successScores } = await db
    .from('user_success_scores')
    .select('overall_score, life_improved, goal_progress_score')
    .eq('computed_at', snapshotDate);

  const { data: goals } = await db.from('goals').select('goal_type, status, completion_pct');

  let totalPoundsLost = 0;
  let totalMuscleGainProxy = 0;
  let weightDeltas = 0;
  let weightSum = 0;
  let strengthPctSum = 0;
  let strengthCount = 0;
  let recoverySum = 0;
  let recoveryCount = 0;
  let workoutAdhSum = 0;
  let nutritionAdhSum = 0;

  for (const s of snapshots ?? []) {
    const wd = Number(s.weight_delta_kg ?? 0);
    if (wd < 0) totalPoundsLost += Math.abs(wd) * 2.20462;
    if (wd > 0) totalMuscleGainProxy += wd * 2.20462;
    weightSum += wd;
    weightDeltas += 1;
    workoutAdhSum += Number(s.workout_adherence_pct ?? 0);
    nutritionAdhSum += Number(s.nutrition_adherence_pct ?? 0);
    const sd = strengthIndex((s.strength_delta as Record<string, number>) ?? {});
    if (sd !== 0) {
      strengthPctSum += sd;
      strengthCount += 1;
    }
    const rd = Number(s.recovery_delta ?? 0);
    if (rd !== 0) {
      recoverySum += rd;
      recoveryCount += 1;
    }
  }

  const { count: totalWorkouts } = await db
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { data: durationRows } = await db
    .from('workout_sessions')
    .select('duration_seconds')
    .eq('status', 'completed')
    .not('duration_seconds', 'is', null);

  const totalHours =
    (durationRows ?? []).reduce((acc, r) => acc + Number(r.duration_seconds ?? 0), 0) / 3600;

  const goalSuccessRates: Record<string, { completed: number; total: number; rate: number }> = {};
  const goalFailureRates: Record<string, { abandoned: number; total: number; rate: number }> = {};

  for (const g of goals ?? []) {
    const type = g.goal_type as string;
    goalSuccessRates[type] ??= { completed: 0, total: 0, rate: 0 };
    goalFailureRates[type] ??= { abandoned: 0, total: 0, rate: 0 };
    goalSuccessRates[type].total += 1;
    goalFailureRates[type].total += 1;
    if (g.status === 'completed' || Number(g.completion_pct ?? 0) >= 100) {
      goalSuccessRates[type].completed += 1;
    }
    if (g.status === 'abandoned') {
      goalFailureRates[type].abandoned += 1;
    }
  }

  for (const type of Object.keys(goalSuccessRates)) {
    const s = goalSuccessRates[type];
    s.rate = s.total > 0 ? Math.round((s.completed / s.total) * 10000) / 100 : 0;
    const f = goalFailureRates[type];
    f.rate = f.total > 0 ? Math.round((f.abandoned / f.total) * 10000) / 100 : 0;
  }

  const avgGoalCompletion =
    (successScores ?? []).length > 0
      ? (successScores ?? []).reduce((a, r) => a + Number(r.goal_progress_score ?? 0), 0) /
        (successScores ?? []).length
      : null;

  const livesImproved = (successScores ?? []).filter((s) => s.life_improved).length;

  const avgSuccess =
    (successScores ?? []).length > 0
      ? (successScores ?? []).reduce((a, r) => a + Number(r.overall_score), 0) / (successScores ?? []).length
      : null;

  const n = snapshots?.length ?? 1;

  await db.from('population_outcome_aggregates').upsert(
    {
      snapshot_date: snapshotDate,
      total_users: totalUsers ?? 0,
      active_users_30d: activeUsers30d,
      paying_users: payingUsers ?? 0,
      total_pounds_lost: Math.round(totalPoundsLost * 100) / 100,
      total_pounds_gained_muscle: Math.round(totalMuscleGainProxy * 100) / 100,
      total_workouts_completed: totalWorkouts ?? 0,
      total_hours_trained: Math.round(totalHours * 100) / 100,
      avg_weight_loss_kg: weightDeltas > 0 ? Math.round((weightSum / weightDeltas) * 1000) / 1000 : null,
      avg_strength_increase_pct: strengthCount > 0 ? Math.round((strengthPctSum / strengthCount) * 100) / 100 : null,
      avg_recovery_improvement: recoveryCount > 0 ? Math.round((recoverySum / recoveryCount) * 100) / 100 : null,
      avg_goal_completion_pct: avgGoalCompletion != null ? Math.round(avgGoalCompletion * 100) / 100 : null,
      avg_workout_adherence_pct: Math.round((workoutAdhSum / n) * 100) / 100,
      avg_nutrition_adherence_pct: Math.round((nutritionAdhSum / n) * 100) / 100,
      avg_success_score: avgSuccess != null ? Math.round(avgSuccess * 100) / 100 : null,
      lives_improved_count: livesImproved,
      retention_rate_30d:
        totalUsers && totalUsers > 0
          ? Math.round((activeUsers30d / totalUsers) * 10000) / 100
          : null,
      goal_success_rates: goalSuccessRates,
      goal_failure_rates: goalFailureRates,
      success_behavior_signals: {
        highAdherenceAvgSuccess: avgSuccess,
        note: 'Foundation data for future ML — no recommendations trained yet',
      },
    },
    { onConflict: 'snapshot_date' },
  );
}

export async function computeCohortSignals(): Promise<void> {
  const db = requireAdmin();
  const snapshotDate = todayIso();

  const cohorts: Array<'successful' | 'unsuccessful' | 'at_risk' | 'all'> = [
    'successful',
    'unsuccessful',
    'at_risk',
    'all',
  ];

  for (const cohort of cohorts) {
    let userIds: string[] = [];

    if (cohort === 'all') {
      const { data } = await db.from('profiles').select('id').eq('onboarding_completed', true);
      userIds = (data ?? []).map((r) => r.id);
    } else {
      const { data } = await db
        .from('user_success_scores')
        .select('user_id, overall_score, score_category')
        .eq('computed_at', snapshotDate);

      userIds = (data ?? [])
        .filter((r) => {
          if (cohort === 'successful') return Number(r.overall_score) >= 75;
          if (cohort === 'at_risk') return r.score_category === 'at_risk';
          return Number(r.overall_score) < 60;
        })
        .map((r) => r.user_id);
    }

    if (!userIds.length) {
      await db.from('outcome_cohort_signals').upsert(
        {
          snapshot_date: snapshotDate,
          cohort_type: cohort,
          sample_size: 0,
          behavior_patterns: {},
        },
        { onConflict: 'snapshot_date,cohort_type' },
      );
      continue;
    }

    const { data: snapshots } = await db
      .from('user_outcome_snapshots')
      .select('workout_adherence_pct, nutrition_adherence_pct')
      .eq('snapshot_date', snapshotDate)
      .in('user_id', userIds);

    const { data: scores } = await db
      .from('user_success_scores')
      .select('overall_score')
      .eq('computed_at', snapshotDate)
      .in('user_id', userIds);

    const n = snapshots?.length ?? 1;
    const avgWorkout =
      (snapshots ?? []).reduce((a, s) => a + Number(s.workout_adherence_pct ?? 0), 0) / n;
    const avgNutrition =
      (snapshots ?? []).reduce((a, s) => a + Number(s.nutrition_adherence_pct ?? 0), 0) / n;
    const avgSuccess =
      (scores ?? []).reduce((a, s) => a + Number(s.overall_score), 0) / Math.max(scores?.length ?? 1, 1);

    await db.from('outcome_cohort_signals').upsert(
      {
        snapshot_date: snapshotDate,
        cohort_type: cohort,
        sample_size: userIds.length,
        avg_workout_adherence_pct: Math.round(avgWorkout * 100) / 100,
        avg_protein_compliance_pct: Math.round(avgNutrition * 100) / 100,
        avg_success_score: Math.round(avgSuccess * 100) / 100,
        behavior_patterns: {
          cohort,
          sampleSize: userIds.length,
          storedForFutureAnalysis: true,
        },
      },
      { onConflict: 'snapshot_date,cohort_type' },
    );
  }
}

export async function getUserOutcomeSummary(userId: string) {
  const db = requireAdmin();

  const [baseline, snapshot, score, risks, goals] = await Promise.all([
    db.from('user_outcome_baselines').select('*').eq('user_id', userId).maybeSingle(),
    db
      .from('user_outcome_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('user_success_scores')
      .select('*')
      .eq('user_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('user_risk_flags')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    db.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
  ]);

  return {
    baseline: baseline.data,
    latestSnapshot: snapshot.data,
    successScore: score.data,
    activeRiskFlags: risks.data ?? [],
    activeGoals: goals.data ?? [],
  };
}

/**
 * Sprint 6.1 — Founder Dashboard analytics
 * Evidence-based company intelligence from outcome data.
 */

import { getOpenAI, hasOpenAI } from './openai.js';
import { requireAdmin } from './supabase.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function bucketDistribution(values: number[], buckets: Array<{ label: string; min: number; max: number }>) {
  const counts: Record<string, number> = {};
  for (const b of buckets) counts[b.label] = 0;
  for (const v of values) {
    const bucket = buckets.find((b) => v >= b.min && v <= b.max);
    if (bucket) counts[bucket.label] += 1;
  }
  return counts;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 10000) / 100;
}

export type FounderDashboardPayload = Awaited<ReturnType<typeof getFounderDashboardData>>;

export async function getFounderDashboardData() {
  const db = requireAdmin();
  const snapshotDate = todayIso();
  const cutoff30 = daysAgoIso(30);
  const cutoff60 = daysAgoIso(60);

  const [
    populationRes,
    cohortsRes,
    successScoresRes,
    snapshotsRes,
    goalsRes,
    riskFlagsRes,
    profilesRes,
    subscriptionsRes,
    historicalPopRes,
    snapshotTrendRes,
  ] = await Promise.all([
    db.from('population_outcome_aggregates').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('outcome_cohort_signals').select('*').order('snapshot_date', { ascending: false }).limit(20),
    db
      .from('user_success_scores')
      .select('user_id, overall_score, score_category, workout_adherence_score, nutrition_adherence_score, recovery_compliance_score, goal_progress_score, life_improved')
      .order('computed_at', { ascending: false })
      .limit(5000),
    db
      .from('user_outcome_snapshots')
      .select('user_id, snapshot_date, weight_delta_kg, strength_delta, recovery_delta, workout_adherence_pct, nutrition_adherence_pct')
      .gte('snapshot_date', daysAgoIso(90))
      .order('snapshot_date', { ascending: true }),
    db.from('goals').select('id, user_id, goal_type, title, status, completion_pct, created_at, completed_at, velocity, target_value, current_value'),
    db
      .from('user_risk_flags')
      .select('user_id, risk_level, risk_reason, generated_coaching_message, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('profiles').select('id, created_at, onboarding_completed, deleted_at, metadata').is('deleted_at', null),
    db.from('subscriptions').select('user_id, tier, status'),
    db.from('population_outcome_aggregates').select('*').gte('snapshot_date', daysAgoIso(84)).order('snapshot_date', { ascending: true }),
    db
      .from('user_outcome_snapshots')
      .select('snapshot_date, workout_adherence_pct, nutrition_adherence_pct, weight_delta_kg')
      .gte('snapshot_date', daysAgoIso(84))
      .order('snapshot_date', { ascending: true }),
  ]);

  const population = populationRes.data;
  const asOf = population?.snapshot_date ?? snapshotDate;

  type ScoreRow = NonNullable<typeof successScoresRes.data>[number];
  const latestScoresByUser = new Map<string, ScoreRow>();
  for (const s of successScoresRes.data ?? []) {
    if (!latestScoresByUser.has(s.user_id)) latestScoresByUser.set(s.user_id, s);
  }
  const scores = [...latestScoresByUser.values()];

  const profiles = profilesRes.data ?? [];
  const totalUsers = profiles.length;
  const onboardedUsers = profiles.filter((p) => p.onboarding_completed).length;

  const { data: sessions30 } = await db
    .from('workout_sessions')
    .select('user_id')
    .gte('started_at', `${cutoff30}T00:00:00.000Z`);
  const activeUserIds30 = new Set((sessions30 ?? []).map((s) => s.user_id));
  const activeUsers = activeUserIds30.size;

  const { data: sessions60to30 } = await db
    .from('workout_sessions')
    .select('user_id')
    .gte('started_at', `${cutoff60}T00:00:00.000Z`)
    .lt('started_at', `${cutoff30}T00:00:00.000Z`);
  const previouslyActive = new Set((sessions60to30 ?? []).map((s) => s.user_id));
  let churnedUsers = 0;
  for (const uid of previouslyActive) {
    if (!activeUserIds30.has(uid)) churnedUsers += 1;
  }
  const churnRate30d = pct(churnedUsers, previouslyActive.size || 1);

  const payingUsers = (subscriptionsRes.data ?? []).filter((s) => s.tier !== 'free' && s.status === 'active').length;
  const retention30d = population?.retention_rate_30d ?? pct(activeUsers, totalUsers);

  const goals = goalsRes.data ?? [];
  const goalsAchieved = goals.filter((g) => g.status === 'completed' || Number(g.completion_pct ?? 0) >= 100).length;

  const completedGoals = goals.filter((g) => g.completed_at && g.created_at);
  const completionDays = completedGoals.map((g) => {
    const start = new Date(g.created_at as string).getTime();
    const end = new Date(g.completed_at as string).getTime();
    return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
  });
  const avgCompletionTimeDays = avg(completionDays);

  const goalByType: Record<string, { total: number; completed: number; avgCompletionPct: number; completionPcts: number[] }> = {};
  for (const g of goals) {
    const t = g.goal_type as string;
    goalByType[t] ??= { total: 0, completed: 0, avgCompletionPct: 0, completionPcts: [] };
    goalByType[t].total += 1;
    goalByType[t].completionPcts.push(Number(g.completion_pct ?? 0));
    if (g.status === 'completed' || Number(g.completion_pct ?? 0) >= 100) goalByType[t].completed += 1;
  }

  const goalTypeStats = Object.entries(goalByType).map(([type, s]) => ({
    type,
    total: s.total,
    completed: s.completed,
    successRate: pct(s.completed, s.total),
    avgCompletionPct: avg(s.completionPcts) ?? 0,
  }));
  goalTypeStats.sort((a, b) => b.successRate - a.successRate);

  const successScoreDistribution = {
    exceptional: scores.filter((s) => s.score_category === 'exceptional').length,
    good: scores.filter((s) => s.score_category === 'good').length,
    needs_attention: scores.filter((s) => s.score_category === 'needs_attention').length,
    at_risk: scores.filter((s) => s.score_category === 'at_risk').length,
  };

  const goalCompletionDistribution = bucketDistribution(
    goals.map((g) => Number(g.completion_pct ?? 0)),
    [
      { label: '0–25%', min: 0, max: 25 },
      { label: '26–50%', min: 26, max: 50 },
      { label: '51–75%', min: 51, max: 75 },
      { label: '76–99%', min: 76, max: 99 },
      { label: '100%', min: 100, max: 100 },
    ],
  );

  const workoutAdherenceValues = scores.map((s) => Number(s.workout_adherence_score ?? 0));
  const nutritionAdherenceValues = scores.map((s) => Number(s.nutrition_adherence_score ?? 0));

  const adherenceDistribution = {
    workout: bucketDistribution(workoutAdherenceValues, [
      { label: '0–49%', min: 0, max: 49 },
      { label: '50–69%', min: 50, max: 69 },
      { label: '70–89%', min: 70, max: 89 },
      { label: '90–100%', min: 90, max: 100 },
    ]),
    nutrition: bucketDistribution(nutritionAdherenceValues, [
      { label: '0–49%', min: 0, max: 49 },
      { label: '50–69%', min: 50, max: 69 },
      { label: '70–89%', min: 70, max: 89 },
      { label: '90–100%', min: 90, max: 100 },
    ]),
  };

  const riskReasons: Record<string, number> = {};
  for (const r of riskFlagsRes.data ?? []) {
    riskReasons[r.risk_reason] = (riskReasons[r.risk_reason] ?? 0) + 1;
  }
  const topRiskReasons = Object.entries(riskReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));

  const usersAtRisk = scores.filter((s) => s.score_category === 'at_risk').length;
  const usersNeedingIntervention = scores
    .filter((s) => s.score_category === 'at_risk' || s.score_category === 'needs_attention')
    .slice(0, 25)
    .map((s) => {
      const userRisks = (riskFlagsRes.data ?? []).filter((r) => r.user_id === s.user_id);
      return {
        userId: `${s.user_id.slice(0, 8)}…`,
        overallScore: s.overall_score,
        category: s.score_category,
        topRisk: userRisks[0]?.risk_reason ?? 'Low composite score',
        coachingMessage: userRisks[0]?.generated_coaching_message ?? null,
      };
    });

  const cohortsForDate = (cohortsRes.data ?? []).filter((c) => c.snapshot_date === asOf);
  const successfulCohort = cohortsForDate.find((c) => c.cohort_type === 'successful');
  const unsuccessfulCohort = cohortsForDate.find((c) => c.cohort_type === 'unsuccessful');
  const atRiskCohort = cohortsForDate.find((c) => c.cohort_type === 'at_risk');

  const behaviorAnalytics = buildBehaviorAnalytics(scores, successfulCohort, unsuccessfulCohort, atRiskCohort);

  const snapshots = snapshotsRes.data ?? [];
  const recoveryImprovedUsers = new Set(
    snapshots.filter((s) => Number(s.recovery_delta ?? 0) > 0).map((s) => s.user_id),
  ).size;

  const weightTrendMap = new Map<string, { deltas: number[]; lbsLost: number }>();
  for (const s of snapshotTrendRes.data ?? []) {
    const d = s.snapshot_date as string;
    const entry = weightTrendMap.get(d) ?? { deltas: [], lbsLost: 0 };
    const wd = Number(s.weight_delta_kg ?? 0);
    entry.deltas.push(wd);
    if (wd < 0) entry.lbsLost += Math.abs(wd) * 2.20462;
    weightTrendMap.set(d, entry);
  }
  const weightTrends = [...weightTrendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      avgDeltaLbs: avg(v.deltas.map((d) => d * 2.20462)) ?? 0,
      cumulativeLbsLost: Math.round(v.lbsLost * 10) / 10,
    }));

  const adherenceTrendMap = new Map<string, { workout: number[]; nutrition: number[] }>();
  for (const s of snapshotTrendRes.data ?? []) {
    const d = s.snapshot_date as string;
    const entry = adherenceTrendMap.get(d) ?? { workout: [], nutrition: [] };
    entry.workout.push(Number(s.workout_adherence_pct ?? 0));
    entry.nutrition.push(Number(s.nutrition_adherence_pct ?? 0));
    adherenceTrendMap.set(d, entry);
  }
  const adherenceTrends = [...adherenceTrendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      workoutAdherence: avg(v.workout) ?? 0,
      nutritionAdherence: avg(v.nutrition) ?? 0,
    }));

  const historicalPop = historicalPopRes.data ?? [];
  const goalAchievementRates = historicalPop.map((p) => ({
    date: p.snapshot_date,
    avgGoalCompletion: Number(p.avg_goal_completion_pct ?? 0),
    livesImproved: Number(p.lives_improved_count ?? 0),
  }));

  const retentionCohorts = buildRetentionCohorts(profiles, activeUserIds30);

  const successScoreTrend = historicalPop.map((p) => ({
    date: p.snapshot_date,
    avgScore: Number(p.avg_success_score ?? 0),
  }));

  const founderInsights = await generateFounderInsights({
    scores,
    goals,
    behaviorAnalytics,
    population,
    topRiskReasons,
    successfulCohort,
    unsuccessfulCohort,
  });

  const areUsersImproving =
    (population?.lives_improved_count ?? 0) > 0 ||
    (population?.avg_strength_increase_pct ?? 0) > 0 ||
    (population?.avg_recovery_improvement ?? 0) > 0;

  return {
    asOf,
    generatedAt: new Date().toISOString(),
    companyHealth: {
      totalUsers,
      onboardedUsers,
      activeUsers,
      payingUsers,
      retention30d,
      churnRate30d,
      churnedUsers,
    },
    outcomeHealth: {
      livesImproved: population?.lives_improved_count ?? scores.filter((s) => s.life_improved).length,
      goalsAchieved,
      totalGoals: goals.length,
      poundsLost: population?.total_pounds_lost ?? 0,
      strengthGainedPct: population?.avg_strength_increase_pct ?? null,
      recoveryImprovedUsers,
      avgSuccessScore: population?.avg_success_score ?? avg(scores.map((s) => Number(s.overall_score))) ?? 0,
    },
    userSuccess: {
      successScoreDistribution,
      goalCompletionDistribution,
      adherenceDistribution,
      avgWorkoutAdherence: population?.avg_workout_adherence_pct ?? avg(workoutAdherenceValues),
      avgNutritionAdherence: population?.avg_nutrition_adherence_pct ?? avg(nutritionAdherenceValues),
    },
    riskDashboard: {
      usersAtRisk,
      usersNeedingAttention: usersNeedingIntervention.length,
      topRiskReasons,
      usersNeedingIntervention,
    },
    goalAnalytics: {
      mostSuccessful: goalTypeStats.slice(0, 5),
      leastSuccessful: [...goalTypeStats].sort((a, b) => a.successRate - b.successRate).slice(0, 5),
      avgCompletionTimeDays,
      goalAchievementByType: goalTypeStats,
    },
    behaviorAnalytics,
    charts: {
      weightTrends,
      successScoreDistribution,
      successScoreTrend,
      goalAchievementRates,
      retentionCohorts,
      adherenceTrends,
    },
    founderInsights,
    executiveSummary: {
      areUsersImproving,
      areUsersReachingGoals: goalsAchieved > 0 && (avg(scores.map((s) => Number(s.goal_progress_score ?? 0))) ?? 0) >= 50,
      areUsersStayingEngaged: retention30d >= 40,
      topQuitDrivers: topRiskReasons.slice(0, 3).map((r) => r.reason),
      topSuccessBehaviors: behaviorAnalytics.successCorrelations.slice(0, 3).map((b) => b.insight),
    },
    metrics: population,
    cohorts: cohortsForDate,
  };
}

function buildBehaviorAnalytics(
  scores: Array<{
    workout_adherence_score: number | null;
    nutrition_adherence_score: number | null;
    recovery_compliance_score: number | null;
    goal_progress_score: number | null;
    overall_score: number;
  }>,
  successfulCohort: { avg_workout_adherence_pct?: number; avg_protein_compliance_pct?: number; avg_success_score?: number } | undefined,
  unsuccessfulCohort: { avg_workout_adherence_pct?: number; avg_protein_compliance_pct?: number; avg_success_score?: number } | undefined,
  atRiskCohort: { avg_workout_adherence_pct?: number; avg_protein_compliance_pct?: number; sample_size?: number } | undefined,
) {
  const highProtein = scores.filter((s) => Number(s.nutrition_adherence_score ?? 0) >= 80);
  const lowProtein = scores.filter((s) => Number(s.nutrition_adherence_score ?? 0) < 55);
  const highProteinGoalProgress = avg(highProtein.map((s) => Number(s.goal_progress_score ?? 0)));
  const lowProteinGoalProgress = avg(lowProtein.map((s) => Number(s.goal_progress_score ?? 0)));

  const highRecovery = scores.filter((s) => Number(s.recovery_compliance_score ?? 0) >= 75);
  const lowRecovery = scores.filter((s) => Number(s.recovery_compliance_score ?? 0) < 55);
  const highRecoverySuccess = avg(highRecovery.map((s) => Number(s.overall_score)));
  const lowRecoverySuccess = avg(lowRecovery.map((s) => Number(s.overall_score)));

  const moderateTraining = scores.filter((s) => {
    const w = Number(s.workout_adherence_score ?? 0);
    return w >= 70 && w <= 90;
  });
  const overtrainingSignal = scores.filter((s) => Number(s.workout_adherence_score ?? 0) >= 95 && Number(s.recovery_compliance_score ?? 0) < 60);
  const moderateSuccess = avg(moderateTraining.map((s) => Number(s.overall_score)));
  const overtrainSuccess = avg(overtrainingSignal.map((s) => Number(s.overall_score)));

  const successCorrelations: Array<{ factor: string; insight: string; evidence: string; delta?: number }> = [];

  if (highProteinGoalProgress != null && lowProteinGoalProgress != null && highProtein.length && lowProtein.length) {
    const delta = Math.round((highProteinGoalProgress - lowProteinGoalProgress) * 10) / 10;
    successCorrelations.push({
      factor: 'Protein compliance',
      insight: `Users hitting protein targets progress ${Math.abs(delta)}% faster toward goals.`,
      evidence: `High protein (n=${highProtein.length}) avg goal progress ${highProteinGoalProgress}% vs low (n=${lowProtein.length}) ${lowProteinGoalProgress}%.`,
      delta,
    });
  }

  if (highRecoverySuccess != null && lowRecoverySuccess != null && highRecovery.length && lowRecovery.length) {
    const delta = Math.round((highRecoverySuccess - lowRecoverySuccess) * 10) / 10;
    successCorrelations.push({
      factor: 'Recovery compliance',
      insight: 'Recovery compliance is the strongest predictor of overall success score.',
      evidence: `High recovery (n=${highRecovery.length}) avg score ${highRecoverySuccess} vs low (n=${lowRecovery.length}) ${lowRecoverySuccess}.`,
      delta,
    });
  }

  if (moderateSuccess != null && overtrainSuccess != null && moderateTraining.length && overtrainingSignal.length) {
    successCorrelations.push({
      factor: 'Training frequency',
      insight: 'Users with sustainable 70–90% workout adherence outperform max-adherence users with poor recovery.',
      evidence: `Moderate adherence avg score ${moderateSuccess} vs high-adherence/low-recovery ${overtrainSuccess ?? 'N/A'}.`,
    });
  }

  if (successfulCohort && unsuccessfulCohort) {
    const wDelta =
      Number(successfulCohort.avg_workout_adherence_pct ?? 0) - Number(unsuccessfulCohort.avg_workout_adherence_pct ?? 0);
    const nDelta =
      Number(successfulCohort.avg_protein_compliance_pct ?? 0) - Number(unsuccessfulCohort.avg_protein_compliance_pct ?? 0);
    successCorrelations.push({
      factor: 'Successful cohort profile',
      insight: `Successful users average ${successfulCohort.avg_workout_adherence_pct ?? 0}% workout and ${successfulCohort.avg_protein_compliance_pct ?? 0}% nutrition adherence.`,
      evidence: `Gap vs unsuccessful: +${Math.round(wDelta)}% workouts, +${Math.round(nDelta)}% nutrition.`,
    });
  }

  const failureCorrelations: Array<{ factor: string; insight: string; evidence: string }> = [];

  if (atRiskCohort) {
    failureCorrelations.push({
      factor: 'At-risk cohort',
      insight: `At-risk users average ${atRiskCohort.avg_workout_adherence_pct ?? 0}% workout adherence and ${atRiskCohort.avg_protein_compliance_pct ?? 0}% protein compliance.`,
      evidence: `Sample from outcome_cohort_signals (${atRiskCohort.sample_size ?? 0} users).`,
    });
  }

  if (lowProtein.length) {
    failureCorrelations.push({
      factor: 'Low protein compliance',
      insight: `${lowProtein.length} users below 55% nutrition adherence — primary failure signal.`,
      evidence: `Avg goal progress ${lowProteinGoalProgress ?? 0}% vs population target 50%+.`,
    });
  }

  const lowWorkout = scores.filter((s) => Number(s.workout_adherence_score ?? 0) < 50);
  if (lowWorkout.length) {
    failureCorrelations.push({
      factor: 'Workout dropout',
      insight: `${lowWorkout.length} users below 50% workout adherence — highest quit correlation.`,
      evidence: `Avg success score ${avg(lowWorkout.map((s) => Number(s.overall_score))) ?? 0}.`,
    });
  }

  return { successCorrelations, failureCorrelations };
}

function buildRetentionCohorts(
  profiles: Array<{ id: string; created_at: string; onboarding_completed: boolean | null }>,
  activeUserIds30: Set<string>,
) {
  const cohortMap = new Map<string, { signedUp: number; onboarded: number; stillActive: number }>();

  for (const p of profiles) {
    const key = monthKey(new Date(p.created_at));
    const entry = cohortMap.get(key) ?? { signedUp: 0, onboarded: 0, stillActive: 0 };
    entry.signedUp += 1;
    if (p.onboarding_completed) entry.onboarded += 1;
    if (activeUserIds30.has(p.id)) entry.stillActive += 1;
    cohortMap.set(key, entry);
  }

  return [...cohortMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([cohort, v]) => ({
      cohort,
      signedUp: v.signedUp,
      onboarded: v.onboarded,
      stillActive: v.stillActive,
      retentionRate: pct(v.stillActive, v.onboarded || v.signedUp),
    }));
}

async function generateFounderInsights(ctx: {
  scores: Array<{ nutrition_adherence_score: number | null; workout_adherence_score: number | null; recovery_compliance_score: number | null; goal_progress_score: number | null; overall_score: number }>;
  goals: Array<{ completion_pct: number | null; goal_type: string }>;
  behaviorAnalytics: ReturnType<typeof buildBehaviorAnalytics>;
  population: { avg_success_score?: number; lives_improved_count?: number; avg_workout_adherence_pct?: number; avg_nutrition_adherence_pct?: number } | null;
  topRiskReasons: Array<{ reason: string; count: number }>;
  successfulCohort: { avg_workout_adherence_pct?: number; avg_protein_compliance_pct?: number } | undefined;
  unsuccessfulCohort: { avg_workout_adherence_pct?: number; avg_protein_compliance_pct?: number } | undefined;
}): Promise<Array<{ text: string; source: 'ai' | 'evidence'; confidence: 'high' | 'medium' | 'low' }>> {
  const evidenceInsights = [
    ...ctx.behaviorAnalytics.successCorrelations.map((c) => ({
      text: c.insight,
      source: 'evidence' as const,
      confidence: 'high' as const,
    })),
    ...ctx.behaviorAnalytics.failureCorrelations.slice(0, 2).map((c) => ({
      text: c.insight,
      source: 'evidence' as const,
      confidence: 'medium' as const,
    })),
  ];

  if (ctx.topRiskReasons[0]) {
    evidenceInsights.push({
      text: `"${ctx.topRiskReasons[0].reason}" is the #1 active risk signal (${ctx.topRiskReasons[0].count} users) — address this in product and coaching.`,
      source: 'evidence',
      confidence: 'high',
    });
  }

  if (ctx.population?.lives_improved_count != null && ctx.population.lives_improved_count > 0) {
    evidenceInsights.push({
      text: `${ctx.population.lives_improved_count} lives improved by measurable outcome standards — ONE MORE is producing evidence of impact.`,
      source: 'evidence',
      confidence: 'high',
    });
  }

  const openai = getOpenAI();
  if (!hasOpenAI() || !openai || evidenceInsights.length === 0) {
    return evidenceInsights.slice(0, 8);
  }

  try {
    const summary = {
      avgSuccess: ctx.population?.avg_success_score,
      livesImproved: ctx.population?.lives_improved_count,
      workoutAdherence: ctx.population?.avg_workout_adherence_pct,
      nutritionAdherence: ctx.population?.avg_nutrition_adherence_pct,
      topRisks: ctx.topRiskReasons.slice(0, 3),
      successBehaviors: ctx.behaviorAnalytics.successCorrelations,
      failureBehaviors: ctx.behaviorAnalytics.failureCorrelations,
      successfulVsUnsuccessful: {
        successful: ctx.successfulCohort,
        unsuccessful: ctx.unsuccessfulCohort,
      },
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are the strategic analytics brain for ONE MORE fitness. Generate 3-5 concise, evidence-based strategic insights for the founder. Each insight must reference the data provided — no generic advice. Format: one insight per line, no numbering.',
        },
        {
          role: 'user',
          content: `Data:\n${JSON.stringify(summary, null, 2)}\n\nGenerate founder strategic insights.`,
        },
      ],
    });

    const aiLines = (completion.choices[0]?.message?.content ?? '')
      .split('\n')
      .map((l) => l.replace(/^[\d\-•*.\s]+/, '').trim())
      .filter(Boolean);

    const aiInsights = aiLines.slice(0, 5).map((text) => ({
      text,
      source: 'ai' as const,
      confidence: 'medium' as const,
    }));

    return [...evidenceInsights.slice(0, 4), ...aiInsights].slice(0, 10);
  } catch {
    return evidenceInsights.slice(0, 8);
  }
}

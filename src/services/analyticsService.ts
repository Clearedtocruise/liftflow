import { mapHistoryItem, mapMeal } from '@/lib/db-mappers';
import { aggregateDailyMeals } from '@/lib/mealAggregation';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IAnalyticsService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';
import type { AnalyticsSnapshot, DashboardSummary, PerformanceTrend } from '@/types';

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeStreak(workoutDates: string[]): number {
  if (workoutDates.length === 0) return 0;

  const uniqueDays = [...new Set(workoutDates.map((d) => d.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (uniqueDays.includes(expectedStr)) {
      streak += 1;
    } else if (i === 0 && uniqueDays[0] !== expectedStr) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (uniqueDays[0] === yesterday.toISOString().slice(0, 10)) {
        streak = 1;
        for (let j = 1; j < uniqueDays.length; j++) {
          const exp = new Date(yesterday);
          exp.setDate(exp.getDate() - j);
          if (uniqueDays[j] === exp.toISOString().slice(0, 10)) streak += 1;
          else break;
        }
      }
      break;
    } else {
      break;
    }
  }

  return streak;
}

export const analyticsService: IAnalyticsService = {
  async getDashboard(userId) {
    try {
      const weekStart = startOfWeek().toISOString();
      const today = new Date().toISOString().slice(0, 10);

      const [profile, weekWorkouts, recentSessions, metrics, goals, nutrition, allDates] = await Promise.all([
        supabase.from('profiles').select('weight_kg, body_fat_pct').eq('id', userId).single(),
        supabase
          .from('workout_sessions')
          .select('total_volume')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('started_at', weekStart),
        supabase
          .from('workout_sessions')
          .select('*, workout_exercises(id)')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(5),
        supabase
          .from('user_metrics')
          .select('recorded_at, weight_kg')
          .eq('user_id', userId)
          .not('weight_kg', 'is', null)
          .order('recorded_at', { ascending: true })
          .limit(30),
        supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
        supabase
          .from('meals')
          .select('id, user_id, meal_type, meal_plan_id, name, calories, protein_g, carbs_g, fat_g, instructions, created_at')
          .eq('user_id', userId)
          .eq('scheduled_date', today),
        supabase
          .from('workout_sessions')
          .select('started_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(60),
      ]);

      const weightGoal = (goals.data ?? []).find(
        (g) => g.goal_type === 'weight_loss' || g.goal_type === 'body_composition',
      );

      const todayMeals = (nutrition.data ?? []).map(mapMeal);
      const mealTotals = aggregateDailyMeals(todayMeals);

      const dashboard: DashboardSummary = {
        streak: computeStreak((allDates.data ?? []).map((d) => d.started_at)),
        weeklyWorkouts: weekWorkouts.data?.length ?? 0,
        weeklyVolume: (weekWorkouts.data ?? []).reduce((s, w) => s + Number(w.total_volume ?? 0), 0),
        activeGoals: goals.data?.length ?? 0,
        recoveryStatus: 'unknown',
        recentPrs: 0,
        currentWeightKg: profile.data?.weight_kg ?? undefined,
        goalWeightKg: weightGoal?.target_value ?? undefined,
        caloriesToday: mealTotals.caloriesConsumed,
        proteinToday: mealTotals.proteinG,
        recentWorkouts: (recentSessions.data ?? []).map((row) =>
          mapHistoryItem({ ...row, workout_exercises: row.workout_exercises }),
        ),
        weightHistory: (metrics.data ?? [])
          .filter((m) => m.weight_kg)
          .map((m) => ({ date: m.recorded_at, weightKg: m.weight_kg! })),
      };

      return ok(dashboard);
    } catch (e) {
      return fromError(e);
    }
  },

  async getSnapshots(userId, periodType) {
    try {
      const { data, error } = await supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .order('snapshot_date', { ascending: false });

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              snapshotDate: row.snapshot_date,
              periodType: row.period_type,
              metrics: row.metrics,
              createdAt: row.created_at,
            }) satisfies AnalyticsSnapshot,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async getPerformanceTrends(userId, exerciseId?) {
    try {
      let query = supabase.from('performance_trends').select('*').eq('user_id', userId);
      if (exerciseId) query = query.eq('exercise_id', exerciseId);

      const { data, error } = await query.order('period_end', { ascending: false });
      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              exerciseId: row.exercise_id ?? undefined,
              trendType: row.trend_type,
              periodStart: row.period_start,
              periodEnd: row.period_end,
              dataPoints: row.data_points ?? [],
              estimated1rm: row.estimated_1rm ?? undefined,
              volumeChangePct: row.volume_change_pct ?? undefined,
              consistencyStreak: row.consistency_streak ?? undefined,
              createdAt: row.created_at,
            }) satisfies PerformanceTrend,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async generateSnapshot(userId, date) {
    try {
      const dashboard = await this.getDashboard(userId);
      if (!dashboard.success) return fail(dashboard.error);

      const { data, error } = await supabase
        .from('analytics_snapshots')
        .insert({
          user_id: userId,
          snapshot_date: date,
          period_type: 'daily',
          metrics: {
            streak: dashboard.data.streak,
            weeklyWorkouts: dashboard.data.weeklyWorkouts,
            weeklyVolume: dashboard.data.weeklyVolume,
            caloriesToday: dashboard.data.caloriesToday,
            proteinToday: dashboard.data.proteinToday,
          },
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        snapshotDate: data.snapshot_date,
        periodType: data.period_type,
        metrics: data.metrics,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },
};

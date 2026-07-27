import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import type { CoachInsight } from '@/components/dashboard/CoachInsightCard';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { describeStrengthGain } from '@/lib/coachInsight';
import type { HealthDailySummary } from '@/lib/healthSyncEngine';
import { withTodayFallback } from '@/lib/homeMetricFallback';
import { localDateString } from '@/lib/localDate';
import { analyticsService } from '@/services/analyticsService';
import { coachInsightService } from '@/services/coachInsightService';
import { healthService } from '@/services/healthService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';

/**
 * A metric the home screen can show. `value` is undefined when the measure exists but has not been
 * recorded — which is a different thing from zero, and has to render differently. A tile that shows
 * "0" for a day Apple Health never reported would be a lie.
 */
export type HomeMetric = {
  value?: number;
  /** Oldest to newest, one entry per day, with gaps preserved. */
  history: (number | undefined)[];
};

export type HomeMetrics = {
  streak: HomeMetric;
  sleepHours: HomeMetric;
  activeCalories: HomeMetric;
  hrvMs: HomeMetric;
  /** Today's score plus the trailing week, so the tile can show direction as well as a number. */
  recovery: HomeMetric;
  recoveryScorePercent?: number;
  recoveryScoreLabel?: string;
  /** Calories eaten today against the active nutrition goal — distinct from calories burned. */
  nutrition: {
    caloriesConsumed?: number;
    caloriesTarget?: number;
    proteinG?: number;
    proteinTargetG?: number;
  };
  /** Absent when no genuine strength gain can be evidenced — the card is then not rendered. */
  coachInsight?: CoachInsight;
  /** True once the health query has come back, whether or not it found anything. */
  healthResolved: boolean;
  /** True when no health sample of any kind exists — the prompt to connect, not an error. */
  healthEmpty: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DAYS = 7;

function formatRecoveryLabel(status?: string): string | undefined {
  if (!status) return undefined;
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function seriesFor(
  summaries: HealthDailySummary[],
  dates: string[],
  pick: (summary: HealthDailySummary) => number | undefined,
): HomeMetric {
  const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
  const history = dates.map((date) => {
    const summary = byDate.get(date);
    const value = summary ? pick(summary) : undefined;
    return Number.isFinite(value) ? value : undefined;
  });
  // The freshest reading, not necessarily today's — HealthKit can lag, and yesterday's sleep is
  // still the number a lifter wants at 7am.
  const latest = [...history].reverse().find((value) => value != null);
  return { value: latest, history };
}

function recentDates(timeZone?: string | null): string[] {
  const today = new Date();
  return Array.from({ length: DAYS }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (DAYS - 1 - index));
    return localDateString(day, timeZone);
  });
}

const EMPTY: HomeMetric = { value: undefined, history: [] };

export function useHomeMetrics(): HomeMetrics {
  const { user } = useAuth();
  const units = useUnits();
  const [streak, setStreak] = useState<HomeMetric>(EMPTY);
  const [sleepHours, setSleepHours] = useState<HomeMetric>(EMPTY);
  const [activeCalories, setActiveCalories] = useState<HomeMetric>(EMPTY);
  const [hrvMs, setHrvMs] = useState<HomeMetric>(EMPTY);
  const [recovery, setRecovery] = useState<HomeMetric>(EMPTY);
  const [nutrition, setNutrition] = useState<HomeMetrics['nutrition']>({});
  const [recoveryScorePercent, setRecoveryScorePercent] = useState<number | undefined>(undefined);
  const [recoveryScoreLabel, setRecoveryScoreLabel] = useState<string | undefined>(undefined);
  const [coachInsight, setCoachInsight] = useState<CoachInsight | undefined>(undefined);
  const [healthResolved, setHealthResolved] = useState(false);
  const [healthEmpty, setHealthEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      // Stay loading until auth has a user — otherwise tiles flash empty CTAs on cold start.
      return;
    }

    const generation = ++loadGenerationRef.current;
    setLoading(true);

    try {
      const dates = recentDates(user.timezone);

      // Fast path: recovery + sleep paint as soon as these resolve — do not wait on coach insight.
      const [healthResult, recoveryResult, recoveryTrendResult] = await Promise.all([
        healthService.getDailySummaries(user.id, DAYS, user.timezone),
        recoveryService.getToday(user.id, user.timezone),
        recoveryService.getTrend(user.id),
      ]);
      if (generation !== loadGenerationRef.current) return;

      const checkInSleepHours =
        recoveryResult.success && recoveryResult.data?.sleepHours != null
          ? recoveryResult.data.sleepHours
          : undefined;

      if (healthResult.success) {
        const summaries = healthResult.data;
        setSleepHours(
          withTodayFallback(seriesFor(summaries, dates, (day) => day.sleepHours), checkInSleepHours),
        );
        setActiveCalories(seriesFor(summaries, dates, (day) => day.activeCalories));
        setHrvMs(seriesFor(summaries, dates, (day) => day.hrvMs));
        setHealthEmpty(summaries.length === 0);
      } else if (checkInSleepHours != null) {
        setSleepHours(withTodayFallback(EMPTY, checkInSleepHours));
        setHealthEmpty(false);
      } else {
        setHealthEmpty(false);
      }
      setHealthResolved(true);

      const todayScore =
        recoveryResult.success && recoveryResult.data
          ? Math.min(100, Math.max(0, Math.round(recoveryResult.data.recoveryScore)))
          : undefined;

      if (todayScore != null && recoveryResult.success && recoveryResult.data) {
        setRecoveryScorePercent(todayScore);
        setRecoveryScoreLabel(formatRecoveryLabel(recoveryResult.data.status));
      } else {
        setRecoveryScorePercent(undefined);
        setRecoveryScoreLabel(undefined);
      }

      if (recoveryTrendResult.success) {
        const byDate = new Map(
          recoveryTrendResult.data.map((point) => [point.checkInDate, point.recoveryScore]),
        );
        const history = dates.map((date) => {
          const score = byDate.get(date);
          return score != null && Number.isFinite(score) && score > 0 ? Math.round(score) : undefined;
        });
        setRecovery({ value: todayScore ?? [...history].reverse().find((v) => v != null), history });
      } else {
        setRecovery({ value: todayScore, history: [] });
      }

      // Recovery/sleep are ready — stop showing empty CTAs while slower tiles finish.
      setLoading(false);

      const [streakResult, nutritionResult, gainResult] = await Promise.all([
        analyticsService.getWorkoutStreak(user.id),
        nutritionService.getDailySummary(user.id, dates[dates.length - 1]),
        coachInsightService.getStrengthGain(user.id),
      ]);
      if (generation !== loadGenerationRef.current) return;

      if (streakResult.success) {
        setStreak({ value: streakResult.data, history: [] });
      }

      if (nutritionResult.success && nutritionResult.data) {
        const summary = nutritionResult.data;
        setNutrition({
          caloriesConsumed: summary.caloriesConsumed > 0 ? summary.caloriesConsumed : undefined,
          caloriesTarget: summary.caloriesTarget,
          proteinG: summary.proteinG > 0 ? summary.proteinG : undefined,
          proteinTargetG: summary.proteinTargetG,
        });
      } else {
        setNutrition({});
      }

      if (gainResult.success && gainResult.data) {
        const gain = gainResult.data;
        const delta = units.preferredWeightUnit === 'lb' ? gain.deltaKg * 2.2046226218 : gain.deltaKg;
        setCoachInsight({
          message: describeStrengthGain(gain, delta, units.weightLabel),
          badge: `+${Math.round(delta)} ${units.weightLabel}`,
          history: gain.history,
        });
      } else {
        setCoachInsight(undefined);
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id, user?.timezone, units.preferredWeightUnit, units.weightLabel]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return {
    streak,
    sleepHours,
    activeCalories,
    hrvMs,
    recovery,
    recoveryScorePercent,
    recoveryScoreLabel,
    nutrition,
    coachInsight,
    healthResolved,
    healthEmpty,
    loading,
    refresh,
  };
}

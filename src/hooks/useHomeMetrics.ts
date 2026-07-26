import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import type { CoachInsight } from '@/components/dashboard/CoachInsightCard';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { describeStrengthGain } from '@/lib/coachInsight';
import type { HealthDailySummary } from '@/lib/healthSyncEngine';
import { localDateString } from '@/lib/localDate';
import { analyticsService } from '@/services/analyticsService';
import { coachInsightService } from '@/services/coachInsightService';
import { healthService } from '@/services/healthService';

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
  const [coachInsight, setCoachInsight] = useState<CoachInsight | undefined>(undefined);
  const [healthResolved, setHealthResolved] = useState(false);
  const [healthEmpty, setHealthEmpty] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const dates = recentDates(user.timezone);
      const [streakResult, healthResult, gainResult] = await Promise.all([
        analyticsService.getWorkoutStreak(user.id),
        healthService.getDailySummaries(user.id, DAYS),
        coachInsightService.getStrengthGain(user.id),
      ]);

      if (streakResult.success) {
        const days = streakResult.data;
        setStreak({ value: days, history: [] });
      }

      if (healthResult.success) {
        const summaries = healthResult.data;
        setSleepHours(seriesFor(summaries, dates, (day) => day.sleepHours));
        setActiveCalories(seriesFor(summaries, dates, (day) => day.activeCalories));
        setHrvMs(seriesFor(summaries, dates, (day) => day.hrvMs));
        setHealthEmpty(summaries.length === 0);
      } else {
        // A failed query is not an empty one: prompting "connect Apple Health" to somebody who
        // already has would be wrong, so leave the tiles blank instead.
        setHealthEmpty(false);
      }
      setHealthResolved(true);

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
      setLoading(false);
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
    coachInsight,
    healthResolved,
    healthEmpty,
    loading,
    refresh,
  };
}

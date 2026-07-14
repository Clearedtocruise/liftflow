import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { EmptyStateCard, ErrorStateCard } from '@/components/layout/StateCard';
import { ExerciseProgressChart } from '@/components/progress/ExerciseProgressChart';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import {
    buildExerciseProgressSeries,
    defaultMetricForSeries,
    metricLabel,
    sliceRecentPoints,
    summarizeProgressDelta,
    type ExerciseProgressMetric,
} from '@/lib/exerciseProgress';
import { workoutService } from '@/services/workoutService';

export default function ExerciseProgressScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const params = useLocalSearchParams<{ exerciseId?: string; name?: string }>();
  const exerciseId = typeof params.exerciseId === 'string' ? params.exerciseId : '';
  const exerciseName =
    typeof params.name === 'string' && params.name.trim() ? params.name.trim() : 'Exercise';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<ExerciseProgressMetric>('estimated_1rm');
  const [rawReady, setRawReady] = useState(false);

  const [series, setSeries] = useState<ReturnType<typeof buildExerciseProgressSeries>>([]);

  const load = useCallback(async () => {
    if (!user || !exerciseId) {
      setLoading(false);
      setError(!exerciseId ? 'Missing exercise.' : null);
      return;
    }

    setLoading(true);
    const result = await workoutService.getExerciseProgressSets(user.id, exerciseId, 80);
    if (!result.success) {
      setError(result.error);
      setSeries([]);
      setLoading(false);
      return;
    }

    const next = buildExerciseProgressSeries(result.data);
    setSeries(next);
    setMetric(defaultMetricForSeries(next));
    setError(null);
    setRawReady(true);
    setLoading(false);
  }, [user, exerciseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartPoints = useMemo(() => sliceRecentPoints(series, 12), [series]);
  const summary = useMemo(() => summarizeProgressDelta(series, metric), [series, metric]);

  const availableMetrics = useMemo(() => {
    const options: ExerciseProgressMetric[] = [];
    if (series.some((p) => (p.estimated1RmKg ?? 0) > 0)) options.push('estimated_1rm');
    if (series.some((p) => p.bestWeightKg > 0)) {
      options.push('best_weight');
      options.push('volume');
    }
    if (series.some((p) => p.bestReps > 0 && p.bestWeightKg <= 0)) options.push('best_reps');
    return options.length > 0 ? options : (['best_reps'] as ExerciseProgressMetric[]);
  }, [series]);

  function formatChartValue(value: number): string {
    if (metric === 'best_reps') return String(Math.round(value));
    if (metric === 'volume') return units.formatVolume(value);
    return units.formatWeight(value);
  }

  if (!user) {
    return (
      <ScreenContainer>
        <EmptyStateCard title="Sign in required" message="Sign in to view lift progress." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppText variant="title">{exerciseName}</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Session-best estimates from your logged sets. Est. 1RM uses Epley for sets of 12 reps or fewer.
      </AppText>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={LiftFlowColors.accent} />
        </View>
      ) : error ? (
        <ErrorStateCard title="Could not load lift history" message={error} onRetry={() => void load()} />
      ) : series.length === 0 ? (
        <EmptyStateCard
          title="Not enough history yet"
          message="Log this lift in a few workouts and your progress chart will appear here."
        />
      ) : (
        <>
          {summary ? (
            <Card style={styles.summaryCard}>
              <AppText variant="caption" color="textSecondary">
                {metricLabel(metric, units.weightLabel)}
              </AppText>
              <AppText variant="headline">
                {metric === 'best_reps'
                  ? `${Math.round(summary.latest)} reps`
                  : metric === 'volume'
                    ? units.formatVolume(summary.latest)
                    : units.formatWeight(summary.latest)}
              </AppText>
              {summary.delta != null ? (
                <AppText variant="footnote" color={summary.delta >= 0 ? 'success' : 'restTimer'}>
                  {summary.delta >= 0 ? '+' : ''}
                  {metric === 'best_reps'
                    ? `${summary.delta} reps`
                    : metric === 'volume'
                      ? units.formatVolume(summary.delta)
                      : units.formatWeight(summary.delta)}
                  {summary.pct != null ? ` (${summary.pct >= 0 ? '+' : ''}${summary.pct}%)` : ''} over chart
                  window
                </AppText>
              ) : (
                <AppText variant="footnote" color="textTertiary">
                  Need one more session to show change.
                </AppText>
              )}
            </Card>
          ) : null}

          <Card>
            <ExerciseProgressChart
              points={chartPoints}
              metric={availableMetrics.includes(metric) ? metric : availableMetrics[0]!}
              weightLabel={units.weightLabel}
              formatValue={formatChartValue}
              availableMetrics={availableMetrics}
              onSelectMetric={setMetric}
            />
          </Card>

          {rawReady ? (
            <AppText variant="caption" color="textTertiary" style={styles.footnote}>
              Showing last {chartPoints.length} training day{chartPoints.length === 1 ? '' : 's'} with logged
              sets.
            </AppText>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.md },
  loading: { paddingVertical: Spacing.xl, alignItems: 'center' },
  summaryCard: { gap: Spacing.xs, marginBottom: Spacing.md },
  footnote: { marginTop: Spacing.sm },
});

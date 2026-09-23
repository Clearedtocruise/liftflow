import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { HistoryCard } from '@/components/history/HistoryCard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { EmptyStateCard } from '@/components/layout/StateCard';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { appendActivityHistory, groupHistoryByMonth } from '@/lib/activityHistoryPage';
import { screenDataCache } from '@/lib/screenDataCache';
import { getCombinedActivityHistory } from '@/services/activityHistoryService';
import { analyticsService } from '@/services/analyticsService';
import { healthService } from '@/services/healthService';
import { workoutService } from '@/services/workoutService';
import type { WorkoutHistoryItem } from '@/types';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ before: string | null; hasMore: boolean }>({
    before: null,
    hasMore: false,
  });
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  // Refreshing in the background must not yank away pages the reader has already pulled up.
  const readingOlderRef = useRef(false);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user) return;

      const generation = ++loadGenerationRef.current;
      const silent = options?.silent ?? hydratedFromCacheRef.current;

      if (!silent) setLoading(true);
      readingOlderRef.current = false;
      setOlderError(null);

      // Load history immediately; pull Apple Fitness in the background so History never freezes.
      const historyResult = await getCombinedActivityHistory(user.id);
      if (generation !== loadGenerationRef.current) return;

      const items = historyResult.success ? historyResult.data.data : [];
      if (historyResult.success) {
        setHistory(items);
        setTotalSessions(historyResult.data.totals.all);
        setCursor({ before: historyResult.data.nextBefore, hasMore: historyResult.data.hasMore });
      }
      setLoading(false);
      setRefreshing(false);

      void (async () => {
        try {
          await healthService.sync(user.id, 14);
        } catch {
          // Non-blocking
        }
        if (generation !== loadGenerationRef.current) return;

        const [refreshed, streakResult] = await Promise.all([
          getCombinedActivityHistory(user.id),
          analyticsService.getWorkoutStreak(user.id),
        ]);
        if (generation !== loadGenerationRef.current) return;

        const nextItems = refreshed.success ? refreshed.data.data : items;
        const streakValue = streakResult.success ? streakResult.data : 0;
        if (refreshed.success && !readingOlderRef.current) {
          setHistory(nextItems);
          setTotalSessions(refreshed.data.totals.all);
          setCursor({ before: refreshed.data.nextBefore, hasMore: refreshed.data.hasMore });
        }
        if (streakResult.success) setStreak(streakValue);
        screenDataCache.writeHistory(user.id, {
          items: nextItems,
          streak: streakValue,
          totalSessions: refreshed.success ? refreshed.data.totals.all : undefined,
        });
      })();
    },
    [user],
  );

  const loadOlder = useCallback(async () => {
    if (!user || loadingOlder || !cursor.hasMore || !cursor.before) return;

    readingOlderRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);

    const result = await getCombinedActivityHistory(user.id, { before: cursor.before });

    setLoadingOlder(false);
    if (!result.success) {
      setOlderError(result.error);
      return;
    }

    // A page that neither adds anything nor moves the cursor would repeat forever; call it the end.
    const stalled = result.data.nextBefore === cursor.before;
    setHistory((current) => appendActivityHistory(current, result.data.data));
    setCursor({
      before: result.data.nextBefore,
      hasMore: result.data.hasMore && !stalled,
    });
  }, [user, loadingOlder, cursor]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const cached = await screenDataCache.readHistory(user.id);
      if (cancelled) return;

      if (cached) {
        setHistory(cached.items);
        setStreak(cached.streak);
        if (cached.totalSessions != null) setTotalSessions(cached.totalSessions);
        setLoading(false);
        hydratedFromCacheRef.current = true;
      }

      void load({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

  const months = useMemo(() => groupHistoryByMonth(history), [history]);

  async function handleDelete(id: string, sessionKind?: WorkoutHistoryItem['sessionKind']) {
    if (sessionKind === 'cardio') {
      Alert.alert('Cardio session', 'Cardio entries are kept for recovery tracking.');
      return;
    }
    Alert.alert('Delete workout', 'Remove this session from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await workoutService.deleteSession(id);
          if (!result.success) {
            Alert.alert('Error', result.error);
            return;
          }
          // Drop it in place rather than reloading, which would throw away older pages.
          setHistory((current) => current.filter((item) => item.id !== id));
          setTotalSessions((current) => (current == null ? current : Math.max(0, current - 1)));
        },
      },
    ]);
  }

  if (loading && history.length === 0) {
    return (
      <ScreenContainer scroll={false}>
        <SectionHeader title="History" subtitle="Track progression over time" />
        <View style={styles.statsRow}>
          <MetricTile label="Day Streak">
            <SkeletonBlock height={40} width="50%" />
          </MetricTile>
          <MetricTile label="Sessions">
            <SkeletonBlock height={40} width="50%" />
          </MetricTile>
        </View>
        <SkeletonBlock height={20} width="40%" />
        <SkeletonBlock height={88} />
        <SkeletonBlock height={88} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load({ silent: true });
          }}
          tintColor={LiftFlowColors.primary}
        />
      }>
      <SectionHeader title="History" subtitle="Track progression over time" />

      <View style={styles.statsRow}>
        <MetricTile label="Day Streak">
          <AppText variant="title" color="accent">
            {streak}
          </AppText>
        </MetricTile>
        <MetricTile label="Sessions">
          <AppText variant="title">{totalSessions ?? history.length}</AppText>
        </MetricTile>
      </View>

      <SectionHeader
        title="All Sessions"
        subtitle="Includes Apple Fitness workouts · Pull to refresh · Long press to delete"
      />

      {history.length === 0 ? (
        <EmptyStateCard
          title="No sessions yet"
          message="Complete a lift in ONE MORE, or pull to refresh to import runs and cardio from Apple Fitness."
          actionLabel="Start a workout"
          onAction={() => router.push('/(tabs)/workout')}
        />
      ) : (
        months.map((month) => (
          <View key={month.key} style={styles.month}>
            <AppText variant="caption" color="textSecondary" style={styles.monthLabel}>
              {month.label.toUpperCase()} · {month.items.length}
            </AppText>
            {month.items.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onPress={
                  item.sessionKind === 'cardio'
                    ? undefined
                    : () => router.push(`/session/${item.id}`)
                }
                onLongPress={() => handleDelete(item.id, item.sessionKind)}
              />
            ))}
          </View>
        ))
      )}

      {olderError ? (
        <AppText variant="caption" color="textSecondary" style={styles.olderNote}>
          {olderError}
        </AppText>
      ) : null}

      {cursor.hasMore ? (
        <PrimaryButton
          label="Load older sessions"
          variant="secondary"
          loading={loadingOlder}
          onPress={() => {
            void loadOlder();
          }}
        />
      ) : history.length > 0 ? (
        <AppText variant="caption" color="textSecondary" style={styles.olderNote}>
          That&apos;s every session on record.
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

/** Local metric tile — same pattern as session detail; no missing layout module. */
function MetricTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card style={styles.metricCard}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'flex-start',
  },
  month: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  monthLabel: {
    letterSpacing: 1,
  },
  olderNote: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});

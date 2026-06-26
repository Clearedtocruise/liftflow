import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { HistoryCard } from '@/components/history/HistoryCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { StatCard } from '@/components/layout/StatCard';
import { EmptyStateCard } from '@/components/layout/StateCard';
import { TabScreenHeader } from '@/components/layout/TabScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { screenDataCache } from '@/lib/screenDataCache';
import { getCombinedActivityHistory } from '@/services/activityHistoryService';
import { analyticsService } from '@/services/analyticsService';
import { workoutService } from '@/services/workoutService';
import type { WorkoutHistoryItem } from '@/types';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;

    const generation = ++loadGenerationRef.current;
    const silent = options?.silent ?? hydratedFromCacheRef.current;

    if (!silent) setLoading(true);

    const historyResult = await getCombinedActivityHistory(user.id);
    if (generation !== loadGenerationRef.current) return;

    const items = historyResult.success ? historyResult.data.data : [];
    if (historyResult.success) setHistory(items);
    setLoading(false);
    setRefreshing(false);

    void (async () => {
      const streakResult = await analyticsService.getWorkoutStreak(user.id);
      if (generation !== loadGenerationRef.current) return;

      const streakValue = streakResult.success ? streakResult.data : 0;
      if (streakResult.success) setStreak(streakValue);

      screenDataCache.writeHistory(user.id, { items, streak: streakValue });
    })();
  }, [user]);

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
        setLoading(false);
        hydratedFromCacheRef.current = true;
      }

      void load({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

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
          if (result.success) load({ silent: true });
          else Alert.alert('Error', result.error);
        },
      },
    ]);
  }

  if (loading && history.length === 0) {
    return (
      <ScreenContainer
        header={<TabScreenHeader title="History" subtitle="Track progression over time" />}
        scroll={false}>
        <View style={styles.statsRow}>
          <StatCard label="Day Streak">
            <SkeletonBlock height={40} width="50%" />
          </StatCard>
          <StatCard label="Sessions">
            <SkeletonBlock height={40} width="50%" />
          </StatCard>
        </View>
        <SkeletonBlock height={20} width="40%" />
        <SkeletonBlock height={88} />
        <SkeletonBlock height={88} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      header={<TabScreenHeader title="History" subtitle="Track progression over time" />}
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
      <View style={styles.statsRow}>
        <StatCard label="Day Streak">
          <AppText variant="metric" color="accent">
            {streak}
          </AppText>
        </StatCard>
        <StatCard label="Sessions">
          <AppText variant="metric">{history.length}</AppText>
        </StatCard>
      </View>

      <SectionHeader
        title="Recent Sessions"
        subtitle="Tap strength sessions to view · Long press to delete"
        variant="secondary"
      />

      {history.length === 0 ? (
        <EmptyStateCard
          title="No sessions yet"
          message="Complete a workout or log cardio to build your history."
          actionLabel="Start a workout"
          onAction={() => router.push('/(tabs)/workout')}
        />
      ) : (
        history.map((item) => (
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
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});

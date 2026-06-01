import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { HistoryCard } from '@/components/history/HistoryCard';
import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';
import { workoutService } from '@/services/workoutService';
import type { WorkoutHistoryItem } from '@/types';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [historyResult, dashboardResult] = await Promise.all([
      workoutService.getHistory(user.id),
      analyticsService.getDashboard(user.id),
    ]);
    if (historyResult.success) setHistory(historyResult.data.data);
    if (dashboardResult.success) setStreak(dashboardResult.data.streak);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    Alert.alert('Delete workout', 'Remove this session from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await workoutService.deleteSession(id);
          if (result.success) load();
          else Alert.alert('Error', result.error);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LiftFlowColors.accent} />}>
      <View style={styles.header}>
        <AppText variant="headline">History</AppText>
        <AppText variant="body" color="textSecondary">
          Track progression over time
        </AppText>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <AppText variant="metric" color="accent">
            {streak}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            Day Streak
          </AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="metric">{history.length}</AppText>
          <AppText variant="caption" color="textSecondary">
            Workouts
          </AppText>
        </Card>
      </View>

      <SectionHeader title="Recent Workouts" subtitle="Tap to view · Long press to delete" />

      {history.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No completed workouts yet.
        </AppText>
      ) : (
        history.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            onPress={() => router.push(`/session/${item.id}`)}
            onLongPress={() => handleDelete(item.id)}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
});

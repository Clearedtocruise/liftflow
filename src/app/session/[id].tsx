import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { socialShareService } from '@/services/socialShareService';
import { workoutService } from '@/services/workoutService';
import type { WorkoutSession } from '@/types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const units = useUnits();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await workoutService.getSession(id);
    if (result.success) setSession(result.data);
    else Alert.alert('Error', result.error);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDelete() {
    if (!session) return;
    Alert.alert('Delete workout', 'Remove this session from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await workoutService.deleteSession(session.id);
          if (result.success) router.back();
          else Alert.alert('Error', result.error);
        },
      },
    ]);
  }

  async function handleShare() {
    if (!session) return;
    const result = await socialShareService.shareWorkoutRecap(session);
    if (!result.success) Alert.alert('Share failed', result.error);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <ScreenContainer>
        <AppText variant="title">Session not found</AppText>
        <PrimaryButton label="Go back" onPress={() => router.back()} />
      </ScreenContainer>
    );
  }

  const durationMinutes = session.durationSeconds
    ? Math.round(session.durationSeconds / 60)
    : session.endedAt
      ? Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
      : 0;

  const prCount = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.filter((set) => set.isPr).length,
    0,
  );

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <View style={styles.header}>
        <AppText variant="title">{session.name}</AppText>
        <AppText variant="body" color="textSecondary">
          {formatDate(session.startedAt)}
        </AppText>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Duration" value={`${durationMinutes} min`} />
        <StatCard label="Sets" value={String(session.totalSets ?? 0)} />
        <StatCard label="Volume" value={units.formatVolume(session.totalVolume)} />
        {prCount > 0 ? <StatCard label="PRs" value={String(prCount)} accent /> : null}
      </View>

      <SectionHeader title="Exercises" subtitle={`${session.exercises.length} exercises`} />

      {session.exercises.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No exercises logged.
        </AppText>
      ) : (
        session.exercises.map((exercise) => (
          <Card key={exercise.id} style={styles.exerciseCard}>
            <AppText variant="bodyBold">{exercise.exercise?.name ?? 'Exercise'}</AppText>
            {exercise.sets.length === 0 ? (
              <AppText variant="footnote" color="textTertiary">
                No sets
              </AppText>
            ) : (
              exercise.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  <AppText variant="footnote" color="textSecondary" style={styles.setNum}>
                    Set {set.setNumber}
                  </AppText>
                  <AppText variant="body">
                    {set.weight != null ? `${units.formatWeight(set.weight)} × ` : ''}
                    {set.reps ?? '—'} reps
                  </AppText>
                  {set.isPr ? (
                    <View style={styles.prBadge}>
                      <AppText variant="caption" color="accent">
                        PR
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </Card>
        ))
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Share Workout" onPress={handleShare} />
        <PrimaryButton label="Delete Session" onPress={handleDelete} variant="secondary" />
      </View>
    </ScreenContainer>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card style={styles.statCard}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyBold" color={accent ? 'accent' : 'textPrimary'}>
        {value}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  back: {
    marginBottom: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    minWidth: '45%',
    flex: 1,
    gap: Spacing.xs,
  },
  exerciseCard: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  setNum: {
    width: 56,
  },
  prBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
});

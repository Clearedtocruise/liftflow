import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { EmptyStateCard } from '@/components/layout/StateCard';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import {
  summarizeExerciseHistory,
  type ExerciseHistorySession,
  type ExerciseSessionSet,
} from '@/lib/exerciseHistory';
import { workoutService } from '@/services/workoutService';

function formatDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "3 days ago" reads faster than a date when the question is "am I due for this lift?". */
function formatSince(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
}

function formatSet(set: ExerciseSessionSet, formatWeight: (kg?: number) => string): string {
  if (set.weightKg != null && set.weightKg > 0 && set.reps != null) {
    return `${formatWeight(set.weightKg)} × ${set.reps}`;
  }
  if (set.reps != null && set.reps > 0) return `${set.reps} reps`;
  if (set.durationSeconds != null && set.durationSeconds > 0) return `${set.durationSeconds}s hold`;
  return 'Logged';
}

export default function ExerciseHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const units = useUnits();
  const [sessions, setSessions] = useState<ExerciseHistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    const result = await workoutService.getExerciseHistory(user.id, id);
    if (result.success) {
      setSessions(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [user, id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = summarizeExerciseHistory(sessions);
  const title = name ?? 'Exercise history';

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <View style={styles.header}>
        <AppText variant="title">{title}</AppText>
        {summary.lastPerformedAt ? (
          <AppText variant="body" color="textSecondary">
            Last trained {formatSince(summary.lastPerformedAt)} · {summary.sessionCount} session
            {summary.sessionCount === 1 ? '' : 's'}
          </AppText>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      ) : error ? (
        <EmptyStateCard
          title="Could not load this history"
          message={error}
          actionLabel="Try again"
          onAction={load}
        />
      ) : sessions.length === 0 ? (
        <EmptyStateCard
          title="No sets logged yet"
          message="Once you train this exercise, every session you do it shows up here — what you lifted, for how many, and when."
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            {summary.bestSet ? (
              <Card style={styles.statCard}>
                <AppText variant="caption" color="textSecondary">
                  Best set
                </AppText>
                <AppText variant="bodyBold" color="accent">
                  {formatSet(summary.bestSet, units.formatWeight)}
                </AppText>
              </Card>
            ) : null}
            <Card style={styles.statCard}>
              <AppText variant="caption" color="textSecondary">
                Sets logged
              </AppText>
              <AppText variant="bodyBold">{summary.setCount}</AppText>
            </Card>
          </View>

          <SectionHeader
            title="Every session"
            subtitle={`${sessions.length} workout${sessions.length === 1 ? '' : 's'} with this lift`}
          />

          {sessions.map((session) => (
            <Card key={session.sessionId} style={styles.sessionCard}>
              <Pressable onPress={() => router.push(`/session/${session.sessionId}`)}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionHeading}>
                    <AppText variant="bodyBold">{formatDay(session.performedAt)}</AppText>
                    <AppText variant="caption" color="textTertiary">
                      {session.sessionName}
                    </AppText>
                  </View>
                  {session.hasPr ? (
                    <View style={styles.prBadge}>
                      <AppText variant="caption" color="accent">
                        PR
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.setList}>
                {session.sets.map((set, index) => (
                  <View key={`${session.sessionId}-${index}`} style={styles.setRow}>
                    <AppText variant="footnote" color="textTertiary" style={styles.setNum}>
                      Set {index + 1}
                    </AppText>
                    <AppText variant="body">{formatSet(set, units.formatWeight)}</AppText>
                    {set.isPr ? (
                      <AppText variant="caption" color="accent">
                        PR
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>

              {session.volumeKg > 0 ? (
                <AppText variant="caption" color="textSecondary">
                  {session.sets.length} sets · {units.formatWeight(session.volumeKg)} total
                </AppText>
              ) : null}
            </Card>
          ))}
        </>
      )}

      <PrimaryButton label="Done" variant="secondary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: {
    marginBottom: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    minWidth: '45%',
    flex: 1,
    gap: Spacing.xs,
  },
  sessionCard: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionHeading: {
    gap: 2,
  },
  setList: {
    gap: Spacing.xs,
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
});

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { WorkoutSession } from '@/types';
import type { PostWorkoutCoachSummary } from '@/types/coachActivation';
import type { WorkoutChallengeRecord } from '@/types/workoutChallenge';

type WorkoutSummaryScreenProps = {
  session: WorkoutSession;
  coachSummary: PostWorkoutCoachSummary | null;
  challenges: WorkoutChallengeRecord[];
  onDone: () => void;
  onShare: () => void;
};

export function WorkoutSummaryScreen({
  session,
  coachSummary,
  challenges,
  onDone,
  onShare,
}: WorkoutSummaryScreenProps) {
  const units = useUnits();

  const durationMinutes = session.durationSeconds
    ? Math.round(session.durationSeconds / 60)
    : session.endedAt
      ? Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
      : 0;

  const prCount = session.exercises.reduce(
    (count, exercise) => count + exercise.sets.filter((set) => set.isPr).length,
    0,
  );

  const completedChallenges = challenges.filter((record) => record.status === 'completed');
  const skippedChallenges = challenges.filter((record) => record.status === 'skipped');

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <LinearGradient colors={['rgba(31, 107, 255, 0.35)', 'rgba(0, 229, 255, 0.12)']} style={styles.heroBorder}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <AppText variant="label" color="success">
              Workout Complete
            </AppText>
          </View>
          <AppText variant="title">{session.name}</AppText>
          <AppText variant="body" color="textSecondary">
            {durationMinutes} min · {session.totalSets ?? 0} sets · {units.formatWeight(session.totalVolume ?? 0)} volume
            {prCount > 0 ? ` · ${prCount} PR${prCount === 1 ? '' : 's'}` : ''}
          </AppText>
        </View>
      </LinearGradient>

      {coachSummary ? (
        <Card style={styles.coachCard} glow>
          <SectionHeader title="Coach Summary" />
          <AppText variant="body" color="textSecondary">
            {coachSummary.workoutSummary}
          </AppText>
          <AppText variant="bodyBold">Recovery</AppText>
          <AppText variant="footnote" color="textSecondary">
            {coachSummary.recoveryRecommendation}
          </AppText>
          <AppText variant="bodyBold">Nutrition</AppText>
          <AppText variant="footnote" color="textSecondary">
            {coachSummary.nutritionRecommendation}
          </AppText>
          {coachSummary.progressionRecommendations.length > 0 ? (
            <>
              <AppText variant="bodyBold">Next Session</AppText>
              {coachSummary.progressionRecommendations.map((line) => (
                <AppText key={line} variant="footnote" color="textSecondary">
                  · {line}
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
      ) : null}

      {challenges.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Coach Challenges"
            subtitle={`${completedChallenges.length} completed · ${skippedChallenges.length} skipped`}
          />
          {challenges.map((record) => (
            <Card
              key={`${record.challengeId}-${record.trigger}-${record.exerciseName ?? 'workout'}`}
              style={styles.challengeCard}
              accent={record.status === 'completed'}>
              <View style={styles.challengeHeader}>
                <AppText variant="bodyBold">{record.title}</AppText>
                <AppText variant="caption" color={record.status === 'completed' ? 'success' : 'textTertiary'}>
                  {record.status === 'completed' ? 'Completed' : 'Skipped'}
                </AppText>
              </View>
              <AppText variant="footnote" color="textSecondary">
                {record.prompt}
              </AppText>
              {record.loggedValue ? (
                <AppText variant="footnote" color="accent">
                  Logged: {record.loggedValue}
                </AppText>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Exercises" subtitle={`${session.exercises.length} exercises logged`} />
        {session.exercises.map((exercise) => (
          <Card key={exercise.id} style={styles.exerciseCard}>
            <AppText variant="bodyBold">{exercise.exercise?.name ?? 'Exercise'}</AppText>
            {exercise.sets.map((set) => (
              <AppText key={set.id} variant="footnote" color="textSecondary">
                Set {set.setNumber}:{' '}
                {set.weight != null ? `${units.formatWeight(set.weight)} × ` : ''}
                {set.reps ?? '—'} reps
                {set.isPr ? ' · PR' : ''}
              </AppText>
            ))}
          </Card>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Share Workout" onPress={onShare} size="large" />
        <PrimaryButton label="Done" onPress={onDone} variant="secondary" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  heroBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  hero: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 229, 168, 0.12)',
  },
  coachCard: {
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.md,
  },
  challengeCard: {
    gap: Spacing.xs,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  exerciseCard: {
    gap: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});

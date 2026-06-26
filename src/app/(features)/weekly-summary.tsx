import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { EscapeScreen } from '@/components/layout/EscapeScreen';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { weeklyCloseoutService } from '@/services/weeklyCloseoutService';
import type { WeeklyCloseoutRecord } from '@/types/weeklyCloseout';

export default function WeeklySummaryScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<WeeklyCloseoutRecord | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await weeklyCloseoutService.prepare(user.id);
    if (result.success) setRecord(result.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <SkeletonBlock height={28} width="55%" />
        <SkeletonBlock height={14} width="40%" />
        <Card style={styles.section}>
          <SkeletonBlock height={120} />
        </Card>
      </ScreenContainer>
    );
  }

  if (!record) {
    return (
      <EscapeScreen
        title="Weekly summary unavailable"
        message="We couldn't load this week's review. Try again from Home or check back after logging more workouts."
        primaryLabel="Go to Home"
      />
    );
  }

  const { summary } = record;
  const { training, nutrition, recovery, progress } = summary;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="headline">Weekly Review</AppText>
        <AppText variant="caption" color="textSecondary">
          {summary.weekStartDate} — {summary.weekEndDate}
        </AppText>

        <Card style={styles.section}>
          <AppText variant="title">Weekly Training Summary</AppText>
          <AppText variant="body">
            Completed: {training.workoutsCompleted} of {training.workoutsPlanned} lifting workouts
          </AppText>
          <AppText variant="body">Total Sets: {training.totalSets}</AppText>
          <AppText variant="body">
            Total Volume: {formatWorkoutWeightForInput(training.totalVolumeKg, units.preferredWeightUnit)}{' '}
            {units.weightLabel}
          </AppText>
          <AppText variant="body">
            Cardio / Sports: {training.cardioSessions} sessions ({training.sportsSessions} sports)
          </AppText>
          <AppText variant="body">Consistency: {training.consistencyScore}%</AppText>
          {training.prs.length > 0 ? (
            <>
              <AppText variant="label" color="accent">
                PRs
              </AppText>
              {training.prs.map((pr) => (
                <AppText key={`${pr.exerciseName}-${pr.detail}`} variant="footnote" color="textSecondary">
                  {pr.exerciseName} — {pr.detail}
                </AppText>
              ))}
            </>
          ) : null}
          {training.workoutsMissed.length > 0 ? (
            <>
              <AppText variant="label" color="warning">
                Missed
              </AppText>
              {training.workoutsMissed.map((name) => (
                <AppText key={name} variant="footnote" color="textSecondary">
                  {name}
                </AppText>
              ))}
            </>
          ) : null}
          <AppText variant="footnote" color="textSecondary">
            Coach: {training.coachSummary}
          </AppText>
        </Card>

        <Card style={styles.section}>
          <AppText variant="title">Weekly Nutrition Summary</AppText>
          <AppText variant="body">
            Meals Completed: {nutrition.mealsCompleted} of {nutrition.mealsPlanned}
          </AppText>
          <AppText variant="body">
            Average Calories: {nutrition.avgCalories} / {nutrition.targetCalories}
          </AppText>
          <AppText variant="body">
            Average Protein: {nutrition.avgProteinG}g / {nutrition.targetProteinG}g
          </AppText>
          <AppText variant="body">Adherence: {nutrition.adherencePct}%</AppText>
          <AppText variant="footnote" color="textSecondary">
            Coach: {nutrition.coachSummary}
          </AppText>
        </Card>

        <Card style={styles.section}>
          <AppText variant="title">Recovery & Progress</AppText>
          <AppText variant="body">Avg Recovery: {recovery.avgRecoveryScore}</AppText>
          <AppText variant="body">Recommendation: {recovery.trainingRecommendation}</AppText>
          <AppText variant="footnote" color="textSecondary">
            {recovery.coachSummary}
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {progress.coachSummary}
          </AppText>
        </Card>

        <PrimaryButton label="Review Next Week Plan" onPress={() => router.push('/(features)/next-week-plan')} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg, paddingBottom: Spacing.huge },
  section: { gap: Spacing.sm },
});

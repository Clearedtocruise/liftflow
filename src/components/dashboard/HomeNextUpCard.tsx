import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { mealTypeLabel } from '@/lib/mealSchedule';
import type { MealType } from '@/types/common';

type HomeNextUpCardProps = {
  nextMeal?: {
    name: string;
    mealType: MealType;
    scheduledTime: string;
    overdue?: boolean;
  } | null;
  caloriesRemaining: number;
  proteinRemainingG: number;
  mealsCompleted: number;
  mealsTotal: number;
  workout?: {
    title: string;
    durationMin?: number;
    startTime?: string;
    trainingLabel: string;
    recoveryScore?: number | null;
  } | null;
  onLogMeal: () => void;
  onStartWorkout: () => void;
  startingWorkout?: boolean;
};

export function HomeNextUpCard({
  nextMeal,
  caloriesRemaining,
  proteinRemainingG,
  mealsCompleted,
  mealsTotal,
  workout,
  onLogMeal,
  onStartWorkout,
  startingWorkout,
}: HomeNextUpCardProps) {
  return (
    <View style={styles.outer}>
      <LinearGradient colors={['rgba(31, 107, 255, 0.28)', 'rgba(0, 229, 255, 0.1)']} style={styles.border}>
        <View style={styles.card}>
          <AppText variant="label" color="accent">
            Next Up
          </AppText>

          {nextMeal ? (
            <Pressable style={styles.section} onPress={onLogMeal}>
              <View style={styles.sectionHeader}>
                <AppText variant="bodyBold">Next meal</AppText>
                {nextMeal.scheduledTime ? (
                  <AppText variant="caption" color={nextMeal.overdue ? 'warning' : 'accent'}>
                    {nextMeal.overdue ? 'Overdue · ' : ''}
                    {nextMeal.scheduledTime}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="footnote" color="textSecondary">
                {mealTypeLabel(nextMeal.mealType)}
              </AppText>
              <AppText variant="body">{nextMeal.name}</AppText>
              <AppText variant="caption" color="textTertiary">
                {caloriesRemaining} cal left · {Math.round(proteinRemainingG)}g protein left · {mealsCompleted}/
                {mealsTotal} meals
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.section}>
              <AppText variant="bodyBold">Nutrition on track</AppText>
              <AppText variant="footnote" color="textSecondary">
                {mealsTotal > 0
                  ? `${mealsCompleted}/${mealsTotal} meals logged today`
                  : 'Generate a meal plan to get coached nutrition targets.'}
              </AppText>
              {mealsTotal === 0 ? (
                <PrimaryButton label="Open Nutrition" onPress={onLogMeal} />
              ) : null}
            </View>
          )}

          {workout ? (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppText variant="bodyBold">Today&apos;s workout</AppText>
                  {workout.startTime ? (
                    <AppText variant="caption" color="accent">
                      {workout.startTime}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="body">{workout.title}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {workout.durationMin ? `${workout.durationMin} min · ` : ''}
                  {workout.recoveryScore != null
                    ? `Recovery ${workout.recoveryScore}% · `
                    : 'Complete check-in for recovery · '}
                  {workout.trainingLabel}
                </AppText>
                <PrimaryButton label="START WORKOUT" onPress={onStartWorkout} loading={startingWorkout} size="large" />
              </View>
            </>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  border: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  card: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: LiftFlowColors.border,
  },
});

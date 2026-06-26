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
  onGenerateMealPlan?: () => void;
  onQuickLogMeal?: () => void;
  onStartWorkout: () => void;
  onViewWorkout?: () => void;
  onManageDay?: () => void;
  onLogActivity?: () => void;
  tabataModeEnabled?: boolean;
  showWorkoutSection?: boolean;
  isRestDay?: boolean;
  startingWorkout?: boolean;
  adaptingPlan?: boolean;
};

export function HomeNextUpCard({
  nextMeal,
  caloriesRemaining,
  proteinRemainingG,
  mealsCompleted,
  mealsTotal,
  workout,
  onLogMeal,
  onGenerateMealPlan,
  onQuickLogMeal,
  onStartWorkout,
  onViewWorkout,
  onManageDay,
  onLogActivity,
  tabataModeEnabled = false,
  showWorkoutSection = false,
  isRestDay = false,
  startingWorkout,
  adaptingPlan,
}: HomeNextUpCardProps) {
  return (
    <View style={styles.outer}>
      <LinearGradient colors={['rgba(31, 107, 255, 0.28)', 'rgba(0, 229, 255, 0.1)']} style={styles.border}>
        <View style={styles.card}>
          {showWorkoutSection && workout && !isRestDay ? (
            <View style={styles.section} testID="today-workout-card">
              <Pressable onPress={onViewWorkout} disabled={!onViewWorkout}>
                <AppText variant="bodyBold">{workout.title}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {workout.startTime ? `${workout.startTime} · ` : ''}
                  {workout.durationMin ? `${workout.durationMin} min` : workout.trainingLabel}
                </AppText>
              </Pressable>
              <PrimaryButton
                label={tabataModeEnabled ? 'Start Tabata' : 'Start Workout'}
                onPress={onStartWorkout}
                loading={startingWorkout}
                size="large"
                testID="start-workout-button"
              />
              {onManageDay ? (
                <PrimaryButton
                  label="Manage Day"
                  variant="ghost"
                  onPress={onManageDay}
                  loading={adaptingPlan}
                  disabled={adaptingPlan}
                  testID="manage-day-button"
                />
              ) : null}
              {onLogActivity ? (
                <PrimaryButton label="Log Activity" variant="secondary" onPress={onLogActivity} />
              ) : null}
            </View>
          ) : showWorkoutSection && isRestDay ? (
            <View style={styles.section}>
              <AppText variant="bodyBold">Rest day</AppText>
              <AppText variant="footnote" color="textSecondary">
                Recovery or light activity
              </AppText>
              {onLogActivity ? (
                <PrimaryButton label="Log Activity" variant="secondary" onPress={onLogActivity} />
              ) : null}
            </View>
          ) : null}

          {showWorkoutSection && (workout || isRestDay) ? <View style={styles.divider} /> : null}

          <View style={styles.section}>
            {nextMeal ? (
              <Pressable onPress={onLogMeal}>
                <AppText variant="bodyBold">{nextMeal.name}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {mealTypeLabel(nextMeal.mealType)}
                  {nextMeal.scheduledTime
                    ? ` · ${nextMeal.overdue ? 'Overdue ' : ''}${nextMeal.scheduledTime}`
                    : ''}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {caloriesRemaining} cal · {Math.round(proteinRemainingG)}g protein · {mealsCompleted}/{mealsTotal}
                </AppText>
              </Pressable>
            ) : (
              <>
                <AppText variant="bodyBold">Nutrition</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {mealsTotal > 0
                    ? `${mealsCompleted}/${mealsTotal} meals · ${caloriesRemaining} cal left`
                    : 'Generate a meal plan or log manually'}
                </AppText>
              </>
            )}
            <PrimaryButton
              label={mealsTotal > 0 ? 'Log Meal' : 'Log a Meal'}
              onPress={mealsTotal > 0 ? onLogMeal : (onQuickLogMeal ?? onLogMeal)}
              variant="secondary"
            />
            {mealsTotal === 0 && onGenerateMealPlan ? (
              <PrimaryButton label="Generate Plan" variant="ghost" onPress={onGenerateMealPlan} />
            ) : null}
          </View>
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
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: LiftFlowColors.border,
  },
});

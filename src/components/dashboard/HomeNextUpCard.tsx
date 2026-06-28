import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { CardLifestyleBanner } from '@/components/layout/CardLifestyleBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { NutritionMetricsRow } from '@/components/nutrition/NutritionMetricsRow';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import { Spacing } from '@/constants/theme';
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
    <View style={styles.stack}>
      {showWorkoutSection && workout && !isRestDay ? (
        <View testID="today-workout-card">
          <Card style={styles.card} glow>
            <CardLifestyleBanner uri={HeroImages.dashboard.cardWorkout} height={96} />
            <Pressable onPress={onViewWorkout} disabled={!onViewWorkout} style={styles.section}>
              <AppText variant="label" color="accent">
                Today&apos;s workout
              </AppText>
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
          </Card>
        </View>
      ) : null}

      {showWorkoutSection && isRestDay ? (
        <Card style={styles.card}>
          <CardLifestyleBanner uri={HeroImages.dashboard.cardRest} height={88} />
          <View style={styles.section}>
            <AppText variant="label" color="accent">
              Recovery
            </AppText>
            <AppText variant="bodyBold">Rest day</AppText>
            <AppText variant="footnote" color="textSecondary">
              Light activity or full recovery — your call.
            </AppText>
          </View>
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
        </Card>
      ) : null}

      <Card style={styles.card}>
        <CardLifestyleBanner uri={HeroImages.dashboard.nutrition} height={88} />
        <AppText variant="label" color="accent">
          Nutrition
        </AppText>

        {mealsTotal > 0 ? (
          <NutritionMetricsRow
            layout="tiles"
            caloriesLabel="Calories"
            caloriesValue={String(Math.max(0, caloriesRemaining))}
            proteinLabel="Protein"
            proteinValue={`${Math.round(proteinRemainingG)}g`}
            mealsLabel="Meals"
            mealsValue={`${mealsCompleted}/${mealsTotal}`}
          />
        ) : null}

        {nextMeal ? (
          <Pressable onPress={onLogMeal} style={styles.section}>
            <AppText variant="label" color="textTertiary">
              Up next
            </AppText>
            <AppText variant="bodyBold" numberOfLines={2}>
              {nextMeal.name}
            </AppText>
            <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
              {mealTypeLabel(nextMeal.mealType)}
              {nextMeal.scheduledTime
                ? ` · ${nextMeal.overdue ? 'Overdue ' : ''}${nextMeal.scheduledTime}`
                : ''}
            </AppText>
          </Pressable>
        ) : mealsTotal === 0 ? (
          <AppText variant="footnote" color="textSecondary">
            Generate a meal plan or log manually
          </AppText>
        ) : null}

        <PrimaryButton
          label={mealsTotal > 0 ? 'Log Meal' : 'Log a Meal'}
          onPress={mealsTotal > 0 ? onLogMeal : (onQuickLogMeal ?? onLogMeal)}
          variant={mealsTotal > 0 ? 'secondary' : 'primary'}
        />
        {mealsTotal === 0 && onGenerateMealPlan ? (
          <PrimaryButton label="Generate Plan" variant="ghost" onPress={onGenerateMealPlan} />
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.lg,
  },
  card: {
    gap: Spacing.md,
    overflow: 'hidden',
  },
  section: {
    gap: Spacing.xs,
  },
});

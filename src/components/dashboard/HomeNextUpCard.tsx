import { Pressable, StyleSheet, View } from 'react-native';

import { HomeTodayCard } from '@/components/dashboard/HomeTodayCard';
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
    coachMessage?: string;
    whyToday?: string | null;
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
  showWorkoutBanner?: boolean;
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
  showWorkoutBanner = true,
  startingWorkout,
  adaptingPlan,
}: HomeNextUpCardProps) {
  return (
    <View style={styles.stack}>
      {showWorkoutSection && workout && !isRestDay ? (
        <HomeTodayCard
          workoutTitle={workout.title}
          coachMessage={workout.coachMessage ?? 'Complete today\'s recovery check-in for personalized guidance.'}
          whyToday={workout.whyToday}
          trainingLabel={workout.trainingLabel}
          startTime={workout.startTime}
          durationMin={workout.durationMin}
          recoveryScore={workout.recoveryScore}
          bannerSources={HeroImages.dashboard.cardWorkout}
          showBanner={showWorkoutBanner}
          onStartWorkout={onStartWorkout}
          onViewWorkout={onViewWorkout}
          onManageDay={onManageDay}
          onLogActivity={onLogActivity}
          tabataModeEnabled={tabataModeEnabled}
          startingWorkout={startingWorkout}
          adaptingPlan={adaptingPlan}
        />
      ) : null}

      {showWorkoutSection && isRestDay ? (
        <Card style={[styles.card, styles.mediaCard]} glow>
          <CardLifestyleBanner
            sources={HeroImages.dashboard.cardRest}
            height={116}
            vibrant
            accentLine
            bleed={false}
          />
          <View style={styles.cardBody}>
            <AppText variant="label" color="accent">
              Recovery
            </AppText>
            <AppText variant="bodyBold">Rest day</AppText>
            <AppText variant="footnote" color="textSecondary">
              Light activity or full recovery — your call.
            </AppText>
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
        </Card>
      ) : null}

      <Card style={[styles.card, styles.mediaCard]} glow>
        <CardLifestyleBanner
          sources={HeroImages.dashboard.nutrition}
          height={116}
          vibrant
          accentLine
          bleed={false}
        />
        <View style={styles.cardBody}>
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
        {onLogActivity ? (
          <PrimaryButton label="+ Activity" variant="ghost" onPress={onLogActivity} testID="log-activity-nutrition-button" />
        ) : null}
        </View>
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
  mediaCard: {
    padding: 0,
    gap: 0,
  },
  cardBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
});

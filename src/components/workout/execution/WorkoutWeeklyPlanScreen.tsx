import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import {
    isConditioningWorkout,
    isToday,
    restDayLabel,
    workoutDurationMinutes,
    workoutExerciseCount,
    workoutMuscleGroups,
    workoutTotalSets,
    type WeekDayPlan,
} from '@/lib/weekPlan';

type WorkoutWeeklyPlanScreenProps = {
  days: WeekDayPlan[];
  loading: boolean;
  refreshing?: boolean;
  adaptingPlan?: boolean;
  timeZone?: string | null;
  onSelectDay: (day: WeekDayPlan) => void;
  onEditDay: (day: WeekDayPlan) => void;
  onManualLog: () => void;
};

function DayCard({
  day,
  timeZone,
  adaptingPlan,
  onSelectDay,
  onEditDay,
}: {
  day: WeekDayPlan;
  timeZone?: string | null;
  adaptingPlan?: boolean;
  onSelectDay: (day: WeekDayPlan) => void;
  onEditDay: (day: WeekDayPlan) => void;
}) {
  const hasWorkout = Boolean(day.workout);
  const isConditioning = hasWorkout && isConditioningWorkout(day.workout!);
  const today = isToday(day.date, timeZone);

  const body = (
    <>
      <Pressable onPress={() => onSelectDay(day)} style={styles.dayPressable}>
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderText}>
            <AppText variant="label" color={today ? 'accent' : 'textSecondary'}>
              {day.dayLabel}
              {today ? ' · Today' : ''}
            </AppText>
            <AppText variant="bodyBold">
              {hasWorkout ? day.workout!.name : restDayLabel(day.dayLabel)}
            </AppText>
          </View>
          {hasWorkout ? (
            <AppText variant="footnote" color={isConditioning ? 'accent' : 'textSecondary'}>
              {isConditioning ? 'Cardio / HIIT' : `${workoutDurationMinutes(day.workout!)} min`}
            </AppText>
          ) : null}
        </View>

        {hasWorkout && !isConditioning ? (
          <>
            <AppText variant="footnote" color="textSecondary">
              {workoutMuscleGroups(day.workout!)}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {workoutExerciseCount(day.workout!)} exercises · {workoutTotalSets(day.workout!)} sets
            </AppText>
          </>
        ) : hasWorkout && isConditioning ? (
          <AppText variant="footnote" color="textSecondary">
            Cardio session · tap to log
          </AppText>
        ) : (
          <AppText variant="footnote" color="textSecondary">
            Recovery, mobility, or optional light activity
          </AppText>
        )}
      </Pressable>
      <PrimaryButton
        label="Edit Day"
        variant="ghost"
        onPress={() => onEditDay(day)}
        loading={adaptingPlan}
        disabled={adaptingPlan}
      />
    </>
  );

  if (today) {
    return (
      <View testID="today-workout-card">
        <GradientBorderCard innerStyle={styles.dayCardInner}>{body}</GradientBorderCard>
      </View>
    );
  }

  return <Card style={styles.dayCard}>{body}</Card>;
}

export function WorkoutWeeklyPlanScreen({
  days,
  loading,
  refreshing = false,
  adaptingPlan = false,
  timeZone,
  onSelectDay,
  onEditDay,
  onManualLog,
}: WorkoutWeeklyPlanScreenProps) {
  return (
    <View style={styles.container} testID="weekly-plan">
      <SectionHeader title="This week" variant="secondary" />

      {loading ? (
        <View style={styles.loadingWrap}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} style={styles.skeletonCard}>
              <SkeletonBlock height={14} width="28%" />
              <SkeletonBlock height={20} width="55%" />
              <SkeletonBlock height={14} width="72%" />
            </Card>
          ))}
        </View>
      ) : null}

      {!loading && refreshing ? (
        <AppText variant="caption" color="textTertiary">
          Updating plan…
        </AppText>
      ) : null}

      {!loading
        ? days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              timeZone={timeZone}
              adaptingPlan={adaptingPlan}
              onSelectDay={onSelectDay}
              onEditDay={onEditDay}
            />
          ))
        : null}

      <PrimaryButton label="Quick log" variant="ghost" onPress={onManualLog} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  loadingWrap: {
    gap: Spacing.md,
  },
  skeletonCard: {
    gap: Spacing.sm,
  },
  dayCard: {
    gap: Spacing.sm,
  },
  dayCardInner: {
    gap: Spacing.sm,
  },
  dayPressable: {
    gap: Spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  dayHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
});

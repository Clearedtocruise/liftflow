import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
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
  onSelectDay: (day: WeekDayPlan) => void;
  onManualLog: () => void;
};

export function WorkoutWeeklyPlanScreen({
  days,
  loading,
  refreshing = false,
  onSelectDay,
  onManualLog,
}: WorkoutWeeklyPlanScreenProps) {
  const showDays = days.length > 0;

  return (
    <View style={styles.container}>
      <AppText variant="headline">Workout</AppText>
      <AppText variant="body" color="textSecondary">
        Your weekly training plan
      </AppText>

      {loading && days.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          Loading weekly plan…
        </AppText>
      ) : null}

      {refreshing ? (
        <AppText variant="caption" color="textTertiary">
          Updating plan…
        </AppText>
      ) : null}

      {showDays
        ? days.map((day) => {
          const hasWorkout = Boolean(day.workout);
          const isConditioning = hasWorkout && isConditioningWorkout(day.workout!);

          return (
          <Pressable key={day.date} onPress={() => onSelectDay(day)}>
            <Card style={[styles.dayCard, styles.dayCardActive, isToday(day.date) && styles.dayCardToday]}>
              <View style={styles.dayHeader}>
                <View>
                  <AppText variant="label" color={isToday(day.date) ? 'accent' : 'textSecondary'}>
                    {day.dayLabel}
                    {isToday(day.date) ? ' · Today' : ''}
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
            </Card>
          </Pressable>
        );})
        : null}

      <Pressable onPress={onManualLog}>
        <AppText variant="footnote" color="accent" align="center">
          Manual Log (fallback)
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  dayCard: {
    gap: Spacing.sm,
  },
  dayCardActive: {
    opacity: 1,
  },
  dayCardToday: {
    borderColor: LiftFlowColors.accent,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
});

import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
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
  onSelectDay: (day: WeekDayPlan) => void;
  onEditDay: (day: WeekDayPlan) => void;
  onManualLog: () => void;
};

export function WorkoutWeeklyPlanScreen({
  days,
  loading,
  refreshing = false,
  adaptingPlan = false,
  onSelectDay,
  onEditDay,
  onManualLog,
}: WorkoutWeeklyPlanScreenProps) {
  return (
    <View style={styles.container}>
      <AppText variant="headline">Workout</AppText>
      <AppText variant="body" color="textSecondary">
        Your weekly training plan
      </AppText>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppText variant="body" color="textSecondary">
            Loading weekly plan…
          </AppText>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonCard}>
              <SkeletonBlock height={14} width="28%" />
              <SkeletonBlock height={20} width="55%" />
              <SkeletonBlock height={14} width="72%" />
            </View>
          ))}
        </View>
      ) : null}

      {!loading && refreshing ? (
        <AppText variant="caption" color="textTertiary">
          Updating plan…
        </AppText>
      ) : null}

      {!loading
        ? days.map((day) => {
            const hasWorkout = Boolean(day.workout);
            const isConditioning = hasWorkout && isConditioningWorkout(day.workout!);

            return (
              <Card
                key={day.date}
                style={[styles.dayCard, styles.dayCardActive, isToday(day.date) && styles.dayCardToday]}>
                <Pressable onPress={() => onSelectDay(day)} style={styles.dayPressable}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayHeaderText}>
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
                </Pressable>
                <PrimaryButton
                  label="Edit Day"
                  variant="ghost"
                  onPress={() => onEditDay(day)}
                  loading={adaptingPlan}
                  disabled={adaptingPlan}
                />
              </Card>
            );
          })
        : null}

      <Pressable onPress={onManualLog}>
        <AppText variant="footnote" color="accent" align="center">
          Manual Log (fallback)
        </AppText>
      </Pressable>
    </View>
  );
}

function SkeletonBlock({
  height,
  width = '100%',
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}) {
  return <View style={[styles.skeleton, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  loadingWrap: {
    gap: Spacing.md,
  },
  skeletonCard: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  skeleton: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  dayCard: {
    gap: Spacing.sm,
  },
  dayPressable: {
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
  dayHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
});

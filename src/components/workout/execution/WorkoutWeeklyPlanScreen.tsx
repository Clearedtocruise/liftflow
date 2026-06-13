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
    workoutExerciseSummary,
    workoutMuscleGroups,
    type WeekDayPlan,
} from '@/lib/weekPlan';

type WorkoutWeeklyPlanScreenProps = {
  days: WeekDayPlan[];
  loading: boolean;
  refreshing?: boolean;
  onSelectDay: (day: WeekDayPlan) => void;
  onConditioning: () => void;
  onManualLog: () => void;
};

export function WorkoutWeeklyPlanScreen({
  days,
  loading,
  refreshing = false,
  onSelectDay,
  onConditioning,
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
          const isConditioning =
            day.dayLabel === 'Saturday' ||
            (day.workout ? day.workout.name.toLowerCase().includes('condition') : false);
          const tappable = Boolean(day.workout) || isConditioning;

          return (
          <Pressable
            key={day.date}
            onPress={() => {
              if (day.workout) onSelectDay(day);
              else if (isConditioning) onConditioning();
            }}
            disabled={!tappable}>
            <Card style={[styles.dayCard, tappable && styles.dayCardActive, isToday(day.date) && styles.dayCardToday]}>
              <View style={styles.dayHeader}>
                <View>
                  <AppText variant="label" color={isToday(day.date) ? 'accent' : 'textSecondary'}>
                    {day.dayLabel}
                    {isToday(day.date) ? ' · Today' : ''}
                  </AppText>
                  <AppText variant="bodyBold">
                    {day.workout?.name ?? (isConditioning ? 'Conditioning or Recovery' : restDayLabel(day.dayLabel))}
                  </AppText>
                </View>
                {day.workout && !isConditioningWorkout(day.workout) ? (
                  <AppText variant="footnote" color="textSecondary">
                    {workoutDurationMinutes(day.workout)} min
                  </AppText>
                ) : isConditioning ? (
                  <AppText variant="footnote" color="accent">
                    Cardio / HIIT
                  </AppText>
                ) : null}
              </View>

              {day.workout && !isConditioningWorkout(day.workout) ? (
                <>
                  <AppText variant="footnote" color="textSecondary">
                    {workoutMuscleGroups(day.workout)} · {workoutExerciseCount(day.workout)} exercises
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {workoutExerciseSummary(day.workout)}
                  </AppText>
                </>
              ) : isConditioning ? (
                <AppText variant="footnote" color="textSecondary">
                  Tabata, HIIT intervals, steady cardio, or recovery walk
                </AppText>
              ) : (
                <AppText variant="footnote" color="textSecondary">
                  Recovery, mobility, or optional conditioning
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
    opacity: 0.85,
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

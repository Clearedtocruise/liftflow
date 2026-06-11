import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FREE_BASELINE_WORKOUTS, type FreeBaselineWorkoutId } from '@/constants/freeBaselineWorkouts';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type FreeBaselineWorkoutsSectionProps = {
  onSelect: (workoutId: FreeBaselineWorkoutId) => void;
  disabled?: boolean;
};

/** Free-tier workouts always available without subscription. */
export function FreeBaselineWorkoutsSection({ onSelect, disabled }: FreeBaselineWorkoutsSectionProps) {
  return (
    <View style={styles.root}>
      <AppText variant="label" color="accent">
        Free Workouts
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Leg Day, Push Day, and Full Body — no subscription required.
      </AppText>
      <View style={styles.grid}>
        {FREE_BASELINE_WORKOUTS.map((workout) => (
          <Pressable
            key={workout.id}
            style={[styles.card, disabled && styles.cardDisabled]}
            disabled={disabled}
            onPress={() => onSelect(workout.id)}
            accessibilityRole="button">
            <AppText variant="bodyBold">{workout.name}</AppText>
            <AppText variant="caption" color="textSecondary">
              {workout.subtitle}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              {workout.exercises.length} exercises
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  grid: {
    gap: Spacing.sm,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
  cardDisabled: {
    opacity: 0.6,
  },
});

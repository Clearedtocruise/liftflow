import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { TrackedLiftExercise } from '@/lib/exerciseProgress';

type LiftProgressSectionProps = {
  lifts: TrackedLiftExercise[];
  loading?: boolean;
};

export function LiftProgressSection({ lifts, loading }: LiftProgressSectionProps) {
  const units = useUnits();

  return (
    <View style={styles.wrap}>
      <AppText variant="headline">Lift progress</AppText>
      <AppText variant="footnote" color="textSecondary">
        Estimated 1RM and best sets across recent sessions — tap a lift for the chart.
      </AppText>

      {loading ? (
        <ActivityIndicator color={LiftFlowColors.accent} style={styles.loader} />
      ) : lifts.length === 0 ? (
        <Card>
          <AppText variant="body" color="textSecondary">
            Complete a few strength workouts and your tracked lifts will show up here.
          </AppText>
        </Card>
      ) : (
        lifts.map((lift) => (
          <Pressable
            key={lift.exerciseId}
            onPress={() =>
              router.push(
                `/(features)/exercise-progress?exerciseId=${encodeURIComponent(lift.exerciseId)}&name=${encodeURIComponent(lift.name)}` as `/(features)/${string}`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Open progress for ${lift.name}`}>
            <Card style={styles.row}>
              <View style={styles.copy}>
                <AppText variant="bodyBold">{lift.name}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {lift.lastWeightKg != null && lift.lastReps != null
                    ? `Last · ${units.formatWeight(lift.lastWeightKg)} × ${lift.lastReps}`
                    : lift.lastReps != null
                      ? `Last · ${lift.lastReps} reps`
                      : `${lift.setCount} sets logged`}
                </AppText>
              </View>
              <AppText variant="caption" color="accent">
                Chart →
              </AppText>
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginBottom: Spacing.md },
  loader: { marginVertical: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  copy: { flex: 1, gap: 2 },
});

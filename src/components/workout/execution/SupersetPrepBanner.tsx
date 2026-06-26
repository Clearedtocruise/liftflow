import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    formatSupersetPartnerNames,
    type SupersetGroup,
} from '@/lib/supersetFlow';
import type { WorkoutExercise } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type SupersetPrepBannerProps = {
  group: SupersetGroup;
  planExercises: EditableWorkoutExercise[];
  sessionExercises: WorkoutExercise[];
  onDismiss: () => void;
};

export function SupersetPrepBanner({
  group,
  planExercises,
  sessionExercises,
  onDismiss,
}: SupersetPrepBannerProps) {
  const partners = formatSupersetPartnerNames(group, planExercises, sessionExercises);

  return (
    <View style={styles.banner}>
      <AppText variant="label" color="accent">
        Superset · get ready
      </AppText>
      <AppText variant="bodyBold">{partners}</AppText>
      <AppText variant="footnote" color="textSecondary">
        Alternate with no rest between partners.
      </AppText>
      <Pressable onPress={onDismiss} style={styles.button}>
        <AppText variant="caption" color="accent">
          Got it
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
});

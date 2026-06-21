import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { resolveExerciseFormGuide } from '@/lib/exerciseFormGuides';
import type { Exercise } from '@/types';

type ExerciseGuideSheetProps = {
  visible: boolean;
  exercise?: Exercise | null;
  exerciseName?: string;
  onClose: () => void;
};

export function ExerciseGuideSheet({
  visible,
  exercise,
  exerciseName,
  onClose,
}: ExerciseGuideSheetProps) {
  const name = exercise?.name ?? exerciseName ?? 'Exercise';
  const guide = resolveExerciseFormGuide(exercise, exerciseName);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="title">How to do it</AppText>
        <AppText variant="bodyBold">{name}</AppText>

        {exercise?.equipment ? (
          <AppText variant="footnote" color="textSecondary">
            {exercise.equipment.replace(/_/g, ' ')}
            {exercise.muscleGroups?.length ? ` · ${exercise.muscleGroups.slice(0, 3).join(', ')}` : ''}
          </AppText>
        ) : null}

        <ExerciseMusclePanel
          exerciseName={name}
          muscleGroups={exercise?.muscleGroups}
          variant="inline"
        />

        {guide ? (
          <View style={styles.section}>
            <AppText variant="caption" color="textTertiary">
              Form cues
            </AppText>
            {guide.steps.map((step, index) => (
              <View key={`${name}-step-${index}`} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <AppText variant="caption" color="accent">
                    {index + 1}
                  </AppText>
                </View>
                <AppText variant="body" style={styles.stepText}>
                  {step}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText variant="body" color="textSecondary">
            Form guide coming soon for this exercise. Focus on controlled reps and a stable setup.
          </AppText>
        )}

        {guide?.tips?.length ? (
          <View style={styles.section}>
            <AppText variant="caption" color="textTertiary">
              Tips
            </AppText>
            {guide.tips.map((tip) => (
              <AppText key={tip} variant="footnote" color="textSecondary">
                · {tip}
              </AppText>
            ))}
          </View>
        ) : null}

        {exercise?.tutorialUrl ? (
          <Pressable
            style={styles.tutorialLink}
            onPress={() => {
              void Linking.openURL(exercise.tutorialUrl!);
            }}>
            <AppText variant="footnote" color="accent">
              Watch tutorial
            </AppText>
          </Pressable>
        ) : null}

        <PrimaryButton label="Back to workout" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(31, 107, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: {
    flex: 1,
  },
  tutorialLink: {
    paddingVertical: Spacing.xs,
  },
});

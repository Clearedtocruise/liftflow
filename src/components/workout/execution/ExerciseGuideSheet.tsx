import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseMovementMedia } from '@/components/exercise/ExerciseMovementMedia';
import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { inferExerciseMetadata } from '@/lib/exerciseEducation/inferExerciseMetadata';
import { guideHasStructure, guideSections, resolveExerciseFormGuide } from '@/lib/exerciseFormGuides';
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
  const sections = guide ? guideSections(guide) : [];
  const structured = guide ? guideHasStructure(guide) : false;
  const inferred = inferExerciseMetadata({
    name,
    slug: exercise?.slug,
    category: exercise?.category,
    equipment: exercise?.equipment,
    muscleGroups: exercise?.muscleGroups,
    secondaryMuscles: exercise?.secondaryMuscles,
    exerciseType: exercise?.exerciseType,
  });
  const primaryMuscles = guide?.musclesWorked?.primary ?? inferred.primaryMuscles;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="title">How to do it</AppText>
        <AppText variant="bodyBold">{name}</AppText>

        <ExerciseMusclePanel
          exerciseName={name}
          muscleGroups={primaryMuscles}
          variant="inline"
        />

        {guide ? <ExerciseMovementMedia guide={guide} exerciseName={name} /> : null}

        {structured ? (
          <View style={styles.sectionList}>
            {sections.map((section) => (
              <View key={section.id} style={styles.sectionCard}>
                <AppText variant="label" color="accent">
                  {section.label}
                </AppText>
                <AppText variant="body" color="textPrimary" style={styles.sectionBody}>
                  {section.body}
                </AppText>
              </View>
            ))}
          </View>
        ) : guide?.steps?.length ? (
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

        {guide?.feelShould?.length || guide?.feelShouldNot?.length ? (
          <View style={styles.feelCard}>
            <AppText variant="label" color="textSecondary">
              What it should feel like
            </AppText>
            {guide.feelShould?.length ? (
              <View style={styles.feelBlock}>
                <AppText variant="footnote" color="accent">
                  You should feel:
                </AppText>
                {guide.feelShould.map((item) => (
                  <AppText key={`should-${item}`} variant="body" color="textPrimary">
                    · {item}
                  </AppText>
                ))}
              </View>
            ) : null}
            {guide.feelShouldNot?.length ? (
              <View style={styles.feelBlock}>
                <AppText variant="footnote" color="textSecondary">
                  You should not feel:
                </AppText>
                {guide.feelShouldNot.map((item) => (
                  <AppText key={`not-${item}`} variant="body" color="textSecondary">
                    · {item}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {guide?.commonMistakes?.length ? (
          <View style={styles.tipsCard}>
            <AppText variant="label" color="textSecondary">
              Common mistakes to avoid
            </AppText>
            {guide.commonMistakes.map((tip) => (
              <AppText key={tip} variant="footnote" color="textSecondary">
                · {tip}
              </AppText>
            ))}
          </View>
        ) : guide?.tips?.length ? (
          <View style={styles.tipsCard}>
            <AppText variant="label" color="textSecondary">
              Common mistakes to avoid
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
              Watch tutorial video
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
    paddingBottom: Spacing.huge,
  },
  sectionList: {
    gap: Spacing.sm,
  },
  sectionCard: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  sectionBody: {
    lineHeight: 22,
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
  },
  stepText: {
    flex: 1,
  },
  feelCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  feelBlock: {
    gap: 4,
  },
  tipsCard: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  tutorialLink: {
    paddingVertical: Spacing.sm,
  },
});

import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseMovementMedia } from '@/components/exercise/ExerciseMovementMedia';
import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';
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
  const styles = useThemedStyles(createStyles);
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
                <AppText variant="body" color="textPrimary" style={styles.stepText}>
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.huge,
    },
    sectionList: {
      gap: theme.spacing.sm,
    },
    sectionCard: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionBody: {
      lineHeight: 22,
    },
    section: {
      gap: theme.spacing.sm,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primaryGlow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: {
      flex: 1,
    },
    feelCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    feelBlock: {
      gap: 4,
    },
    tipsCard: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tutorialLink: {
      paddingVertical: theme.spacing.sm,
    },
  });
}

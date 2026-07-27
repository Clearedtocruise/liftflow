import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseMovementPhases } from '@/components/exercise/ExerciseMovementPhases';
import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { MuscleBreakdownRow } from '@/components/exercise/MuscleBreakdownRow';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { muscleLabel } from '@/constants/muscles';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { resolveExerciseDifficulty } from '@/lib/exerciseDifficulty';
import { resolveExerciseFormGuide } from '@/lib/exerciseFormGuides';
import { resolveExerciseGuideSections } from '@/lib/exerciseGuideSections';
import { profileFigureGender, resolveExerciseMuscles } from '@/lib/exerciseMuscleMap';
import type { Exercise } from '@/types';

type ExerciseGuideSheetProps = {
  visible: boolean;
  exercise?: Exercise | null;
  exerciseName?: string;
  onClose: () => void;
  /** Shown as the primary action when the sheet is opened while picking an exercise. */
  onAddToWorkout?: () => void;
};

export function ExerciseGuideSheet({
  visible,
  exercise,
  exerciseName,
  onClose,
  onAddToWorkout,
}: ExerciseGuideSheetProps) {
  const { user } = useAuth();
  const name = exercise?.name ?? exerciseName ?? 'Exercise';
  const guide = resolveExerciseFormGuide(exercise, exerciseName);
  const sections = useMemo(() => resolveExerciseGuideSections(guide), [guide]);
  const difficulty = resolveExerciseDifficulty(exercise, exerciseName);
  const profile = useMemo(
    () => resolveExerciseMuscles(name, exercise?.muscleGroups),
    [name, exercise?.muscleGroups],
  );
  const [gender, setGender] = useState<'male' | 'female'>(profileFigureGender(user?.sex));

  const equipmentLabel = exercise?.equipment ? exercise.equipment.replace(/_/g, ' ') : null;
  const primaryMuscles = profile.primary.map(muscleLabel);
  const summary = [equipmentLabel, difficulty, exercise?.category].filter(Boolean).join(' · ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topBar}>
            <AppText variant="label" color="accent">
              EXERCISE GUIDE
            </AppText>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <AppText variant="bodyBold" color="accent">
                Close
              </AppText>
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <AppText variant="headline" style={styles.title}>
              {name.toUpperCase()}
            </AppText>
            {primaryMuscles.length > 0 ? (
              <AppText variant="caption" color="accent">
                {primaryMuscles.join(' · ').toUpperCase()}
              </AppText>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {equipmentLabel ? <MetaChip caption="EQUIPMENT" value={equipmentLabel} /> : null}
            <MetaChip caption="DIFFICULTY" value={difficulty} />
          </View>

          {summary ? (
            <AppText variant="footnote" color="textSecondary" style={styles.summary}>
              {summary}
            </AppText>
          ) : null}

          {sections.phases.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              Form guide coming soon for this exercise. Focus on controlled reps and a stable setup.
            </AppText>
          ) : (
            // Modal children stay mounted while hidden, so the walkthrough is unmounted rather than
            // left autoplaying behind a closed sheet.
            visible && <ExerciseMovementPhases phases={sections.phases} resetKey={name} />
          )}

          {sections.breathing ? (
            <View style={styles.card}>
              <AppText variant="label" color="accent">
                BREATHING
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {sections.breathing}
              </AppText>
            </View>
          ) : null}

          {sections.cues.length > 0 ? (
            <GuideList caption="KEY CUES" items={sections.cues} bullet="✓" bulletColor="success" />
          ) : null}

          {sections.avoid.length > 0 ? (
            <GuideList caption="AVOID" items={sections.avoid} bullet="✕" bulletColor="error" />
          ) : null}

          {sections.easier.length > 0 || sections.harder.length > 0 ? (
            <View style={styles.card}>
              <AppText variant="label" color="accent">
                SCALE IT
              </AppText>
              {sections.easier.map((item) => (
                <View key={item} style={styles.cueRow}>
                  <AppText variant="caption" color="textTertiary">
                    Easier
                  </AppText>
                  <AppText variant="footnote" color="textSecondary" style={styles.cueText}>
                    {item}
                  </AppText>
                </View>
              ))}
              {sections.harder.map((item) => (
                <View key={item} style={styles.cueRow}>
                  <AppText variant="caption" color="textTertiary">
                    Harder
                  </AppText>
                  <AppText variant="footnote" color="textSecondary" style={styles.cueText}>
                    {item}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="label" color="accent">
                MUSCLES WORKED
              </AppText>
              <View style={styles.genderRow}>
                <GenderChip
                  label="Male"
                  active={gender === 'male'}
                  onPress={() => setGender('male')}
                />
                <GenderChip
                  label="Female"
                  active={gender === 'female'}
                  onPress={() => setGender('female')}
                />
              </View>
            </View>
            <ExerciseMusclePanel
              exerciseName={name}
              muscleGroups={exercise?.muscleGroups}
              gender={gender}
              variant="hero"
            />

            {profile.primary.length > 0 ? (
              <MuscleBreakdownRow muscles={profile.primary} gender={gender} />
            ) : null}
          </View>

          {exercise?.tutorialUrl ? (
            <Pressable
              accessibilityRole="link"
              style={styles.tutorialLink}
              onPress={() => {
                void Linking.openURL(exercise.tutorialUrl!);
              }}>
              <AppText variant="footnote" color="accent">
                Watch tutorial
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {onAddToWorkout ? (
            <PrimaryButton label="Add to Workout" size="large" onPress={onAddToWorkout} />
          ) : null}
          <PrimaryButton
            label={onAddToWorkout ? 'Cancel' : 'Back to workout'}
            variant="secondary"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

function GuideList({
  caption,
  items,
  bullet,
  bulletColor,
}: {
  caption: string;
  items: string[];
  bullet: string;
  bulletColor: 'success' | 'error';
}) {
  return (
    <View style={styles.card}>
      <AppText variant="label" color="accent">
        {caption}
      </AppText>
      {items.map((item) => (
        <View key={item} style={styles.cueRow}>
          <AppText variant="caption" color={bulletColor}>
            {bullet}
          </AppText>
          <AppText variant="footnote" color="textSecondary" style={styles.cueText}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function MetaChip({ caption, value }: { caption: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <AppText variant="caption" color="textTertiary">
        {caption}
      </AppText>
      <AppText variant="bodyBold" style={styles.metaValue}>
        {value}
      </AppText>
    </View>
  );
}

function GenderChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.genderChip, active && styles.genderChipActive]}>
      <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  titleBlock: {
    gap: Spacing.xs,
  },
  title: {
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metaChip: {
    flex: 1,
    gap: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  metaValue: {
    textTransform: 'capitalize',
  },
  summary: {
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cueText: {
    flex: 1,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  genderChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  genderChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  tutorialLink: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  footer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.background,
  },
});

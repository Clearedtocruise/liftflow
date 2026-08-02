import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { MovementPhase } from '@/lib/exerciseGuideSections';

type ExerciseMovementPhasesProps = {
  phases: MovementPhase[];
  /** Resets the guide when the sheet is reopened on a different exercise. */
  resetKey?: string;
};

/**
 * Written form instructions, one step at a time.
 *
 * This used to autoplay text behind playback and speed controls. Those are video affordances,
 * so the UI implied media that did not exist. Keep written guidance honest and only show a video
 * action from ExerciseGuideSheet when the exercise has a real tutorial URL.
 */
export function ExerciseMovementPhases({ phases, resetKey }: ExerciseMovementPhasesProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [resetKey, phases.length]);

  if (phases.length === 0) return null;

  const phase = phases[Math.min(index, phases.length - 1)]!;
  const hasPrevious = index > 0;
  const hasNext = index < phases.length - 1;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="label" color="accent">
          WRITTEN FORM GUIDE
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Step {index + 1} of {phases.length}
        </AppText>
      </View>

      <AppText variant="caption" color="textTertiary">
        Step-by-step instructions · video appears only when available
      </AppText>

      <View style={styles.phaseRow}>
        {phases.map((item, phaseIndex) => (
          <Pressable
            key={`${item.label}-${phaseIndex}`}
            accessibilityRole="button"
            accessibilityLabel={`Phase ${phaseIndex + 1}: ${item.label}`}
            accessibilityState={{ selected: phaseIndex === index }}
            onPress={() => setIndex(phaseIndex)}
            style={[styles.phaseChip, phaseIndex === index && styles.phaseChipActive]}>
            <AppText
              variant="caption"
              color={phaseIndex === index ? 'accent' : 'textTertiary'}
              numberOfLines={1}>
              {item.label.toUpperCase()}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.detail}>
        <View style={styles.stepHeading}>
          <View style={styles.stepNumber}>
            <AppText variant="caption" color="background">
              {index + 1}
            </AppText>
          </View>
          <AppText variant="bodyBold">{phase.label.toUpperCase()}</AppText>
        </View>
        <AppText variant="body" color="textSecondary">
          {phase.detail}
        </AppText>
      </View>

      <View style={styles.controls}>
        <StepButton
          label="Previous"
          accessibilityLabel="Previous form step"
          disabled={!hasPrevious}
          onPress={() => setIndex((current) => Math.max(0, current - 1))}
        />
        <StepButton
          label={hasNext ? 'Next step' : 'Review setup'}
          accessibilityLabel={hasNext ? 'Next form step' : 'Return to first form step'}
          onPress={() => setIndex((current) => (hasNext ? current + 1 : 0))}
        />
      </View>
    </View>
  );
}

function StepButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        disabled && styles.stepButtonDisabled,
        pressed && !disabled && styles.stepButtonPressed,
      ]}>
      <AppText variant="bodyBold" color={disabled ? 'textTertiary' : 'textPrimary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  phaseChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  phaseChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  detail: {
    gap: Spacing.xs,
    minHeight: 76,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  stepHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepButton: {
    flex: 1,
    minHeight: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepButtonPressed: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
});

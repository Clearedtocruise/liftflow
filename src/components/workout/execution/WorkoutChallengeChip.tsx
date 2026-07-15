import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WorkoutChallengeTemplate } from '@/types/workoutChallenge';

type WorkoutChallengeChipProps = {
  challenge: WorkoutChallengeTemplate;
  onApply: () => void;
  onDismiss: () => void;
  onDontShowAgain?: () => void;
};

/** Soft optional coach cue — never blocks rest, supersets, or logging. */
export function WorkoutChallengeChip({
  challenge,
  onApply,
  onDismiss,
  onDontShowAgain,
}: WorkoutChallengeChipProps) {
  return (
    <View style={styles.chip} testID="workout-challenge-chip">
      <View style={styles.badge}>
        <AppText variant="caption" color="warning">
          Optional challenge
        </AppText>
      </View>
      <AppText variant="bodyBold">{challenge.title}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {challenge.prompt}
      </AppText>
      <View style={styles.actions}>
        <Pressable onPress={onApply} style={styles.applyBtn} accessibilityRole="button">
          <AppText variant="caption" color="accent">
            Apply to next set
          </AppText>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
          <AppText variant="caption" color="textTertiary">
            Dismiss
          </AppText>
        </Pressable>
      </View>
      {onDontShowAgain ? (
        <Pressable onPress={onDontShowAgain} hitSlop={8} accessibilityRole="button">
          <AppText variant="caption" color="textTertiary">
            Don&apos;t show again this workout
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.35)',
    backgroundColor: 'rgba(255, 200, 87, 0.08)',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  applyBtn: {
    paddingVertical: Spacing.xs,
  },
});

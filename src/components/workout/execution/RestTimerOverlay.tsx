import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type RestTimerOverlayProps = {
  visible: boolean;
  secondsRemaining: number | null;
  recommendedSeconds: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onAdjust: (deltaSeconds: number) => void;
  onSetRest: (seconds: number) => void;
};

const REST_PRESETS = [60, 90, 120, 150, 180];

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RestTimerOverlay({
  visible,
  secondsRemaining,
  recommendedSeconds,
  isPaused,
  onPause,
  onResume,
  onSkip,
  onAdjust,
  onSetRest,
}: RestTimerOverlayProps) {
  const displaySeconds = secondsRemaining ?? recommendedSeconds;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <AppText variant="label" color="restTimer" align="center">
            Rest Timer
          </AppText>
          <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
            {formatTime(displaySeconds)}
          </AppText>
          <AppText variant="footnote" color="textSecondary" align="center">
            {isPaused ? 'Paused' : 'Adjust rest before your next set'}
          </AppText>

          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={() => onAdjust(-30)}>
              <AppText variant="bodyBold">−30s</AppText>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={isPaused ? onResume : onPause}>
              <AppText variant="bodyBold">{isPaused ? 'Resume' : 'Pause'}</AppText>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={() => onAdjust(30)}>
              <AppText variant="bodyBold">+30s</AppText>
            </Pressable>
          </View>

          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={() => onAdjust(60)}>
              <AppText variant="bodyBold">+1 min</AppText>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={onSkip}>
              <AppText variant="bodyBold">Skip</AppText>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {REST_PRESETS.map((seconds) => (
              <Pressable key={seconds} style={styles.presetButton} onPress={() => onSetRest(seconds)}>
                <AppText variant="caption">{seconds}s</AppText>
              </Pressable>
            ))}
          </ScrollView>

          <PrimaryButton label="Continue" onPress={onSkip} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: LiftFlowColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: LiftFlowColors.restTimerMuted,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  timer: {
    fontSize: 56,
    lineHeight: 64,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  presetRow: {
    gap: Spacing.sm,
  },
  presetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    marginRight: Spacing.sm,
  },
});

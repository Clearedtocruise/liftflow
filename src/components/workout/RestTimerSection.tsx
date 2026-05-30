import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';

type RestTimerSectionProps = {
  secondsRemaining?: number | null;
  recommendedSeconds?: number;
  isActive?: boolean;
  onAdjust?: (deltaSeconds: number) => void;
  onSkip?: () => void;
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RestTimerSection({
  secondsRemaining = null,
  recommendedSeconds = DEFAULT_REST_SECONDS,
  isActive = false,
  onAdjust,
  onSkip,
}: RestTimerSectionProps) {
  const displaySeconds = secondsRemaining ?? recommendedSeconds;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="subhead" color="textSecondary">
          Rest Timer
        </AppText>
        {isActive ? (
          <View style={styles.liveDot}>
            <View style={styles.dot} />
            <AppText variant="caption" color="restTimer">
              Active
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="textTertiary">
            Idle
          </AppText>
        )}
      </View>

      <AppText variant="timer" color="restTimer" style={styles.timer}>
        {formatTime(displaySeconds)}
      </AppText>

      <AppText variant="footnote" color="textSecondary">
        {isActive
          ? `Recommended ${formatTime(recommendedSeconds)} for compound lifts`
          : 'Rest starts automatically after each logged set'}
      </AppText>

      {isActive ? (
        <>
          <View style={styles.adjustRow}>
            {[
              { label: '−30s', delta: -30 },
              { label: '−15s', delta: -15 },
              { label: '+15s', delta: 15 },
              { label: '+30s', delta: 30 },
            ].map(({ label, delta }) => (
              <Pressable
                key={label}
                style={({ pressed }) => [styles.adjustButton, pressed && styles.adjustPressed]}
                onPress={() => onAdjust?.(delta)}
                accessibilityRole="button"
                accessibilityLabel={label}>
                <AppText variant="caption" color="textPrimary">
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Skip Rest" onPress={() => onSkip?.()} variant="secondary" />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.restTimerMuted,
    borderColor: 'rgba(100, 210, 255, 0.25)',
    marginBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.restTimer,
  },
  timer: {
    marginBottom: Spacing.xs,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  adjustButton: {
    flex: 1,
    minHeight: TouchTarget.min,
    borderRadius: Radius.sm,
    backgroundColor: LiftFlowColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  adjustPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
});

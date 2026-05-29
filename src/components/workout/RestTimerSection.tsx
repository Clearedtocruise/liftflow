import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';

type RestTimerSectionProps = {
  secondsRemaining?: number;
  recommendedSeconds?: number;
  isActive?: boolean;
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RestTimerSection({
  secondsRemaining = DEFAULT_REST_SECONDS,
  recommendedSeconds = DEFAULT_REST_SECONDS,
  isActive = true,
}: RestTimerSectionProps) {
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
        ) : null}
      </View>

      <AppText variant="timer" color="restTimer" style={styles.timer}>
        {formatTime(secondsRemaining)}
      </AppText>

      <AppText variant="footnote" color="textSecondary">
        Recommended {formatTime(recommendedSeconds)} for compound lifts
      </AppText>

      <View style={styles.adjustRow}>
        {['−30s', '−15s', '+15s', '+30s'].map((label) => (
          <View key={label} style={styles.adjustButton}>
            <AppText variant="caption" color="textPrimary">
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.restTimerMuted,
    borderColor: 'rgba(100, 210, 255, 0.25)',
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
});

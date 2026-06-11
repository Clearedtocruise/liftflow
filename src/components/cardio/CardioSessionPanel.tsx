import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { getCardioActivityLabel } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type CardioSessionPanelProps = {
  activityId?: string;
  sessionName: string;
  onFinish: () => void;
  finishing?: boolean;
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CardioSessionPanel({ activityId, sessionName, onFinish, finishing }: CardioSessionPanelProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const activityLabel = getCardioActivityLabel(activityId);

  return (
    <View style={styles.card}>
      <AppText variant="label" color="accent">
        Cardio Session
      </AppText>
      <AppText variant="title">{activityLabel}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {sessionName}
      </AppText>
      <View style={styles.timerWrap}>
        <AppText variant="metric" style={styles.timer}>
          {formatElapsed(elapsed)}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Elapsed time
        </AppText>
      </View>
      <AppText variant="footnote" color="textSecondary">
        Log your session when finished. Apple Health workouts sync separately from Settings.
      </AppText>
      <PrimaryButton label={finishing ? 'Saving…' : 'Finish Cardio'} onPress={onFinish} loading={finishing} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    marginBottom: Spacing.xxl,
  },
  timerWrap: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  timer: {
    fontSize: 48,
    lineHeight: 52,
    color: LiftFlowColors.accent,
  },
});

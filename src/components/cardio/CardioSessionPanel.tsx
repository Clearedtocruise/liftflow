import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IntervalTimerPanel } from '@/components/cardio/IntervalTimerPanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type CardioSessionPanelProps = {
  activity: CardioActivity;
};

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function CardioSessionPanel({ activity }: CardioSessionPanelProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!running || activity.mode !== 'steady') return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [activity.mode, running]);

  if (activity.mode === 'tabata' || activity.mode === 'interval') {
    return (
      <IntervalTimerPanel
        activity={activity}
        onComplete={(seconds) => {
          setElapsed(seconds);
          setCompleted(true);
        }}
      />
    );
  }

  return (
    <View style={styles.steadyCard}>
      <AppText variant="label" color="accent" align="center">
        {activity.label}
      </AppText>
      <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
        {formatElapsed(elapsed)}
      </AppText>
      <AppText variant="footnote" color="textSecondary" align="center">
        {completed ? 'Session logged locally' : running ? 'Session in progress' : 'Ready when you are'}
      </AppText>
      <PrimaryButton
        label={running ? 'Pause' : completed ? 'Restart' : 'Start'}
        onPress={() => {
          if (completed) {
            setElapsed(0);
            setCompleted(false);
            setRunning(true);
            return;
          }
          setRunning((current) => !current);
          if (!running) setCompleted(false);
        }}
      />
      {running ? (
        <PrimaryButton
          label="Finish"
          variant="secondary"
          onPress={() => {
            setRunning(false);
            setCompleted(true);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  steadyCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  timer: {
    fontSize: 56,
    lineHeight: 64,
  },
});

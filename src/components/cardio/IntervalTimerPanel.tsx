import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type IntervalPhase = 'work' | 'rest' | 'done';

type IntervalTimerPanelProps = {
  activity: CardioActivity;
  onComplete: (elapsedSeconds: number) => void;
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function IntervalTimerPanel({ activity, onComplete }: IntervalTimerPanelProps) {
  const rounds = activity.rounds ?? 8;
  const workSeconds = activity.workSeconds ?? 20;
  const restSeconds = activity.restSeconds ?? 10;

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<IntervalPhase>('work');
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(workSeconds);
  const [elapsed, setElapsed] = useState(0);

  const phaseLabel = useMemo(() => {
    if (phase === 'done') return 'Complete';
    return phase === 'work' ? 'Work' : 'Rest';
  }, [phase]);

  useEffect(() => {
    if (!running || phase === 'done') return;

    const timer = setInterval(() => {
      setSecondsLeft((current) => current - 1);
      setElapsed((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [running, phase]);

  useEffect(() => {
    if (!running || secondsLeft > 0) return;

    if (phase === 'work') {
      setPhase('rest');
      setSecondsLeft(restSeconds);
      return;
    }

    if (round >= rounds) {
      setPhase('done');
      setRunning(false);
      onComplete(elapsed);
      return;
    }

    setRound((current) => current + 1);
    setPhase('work');
    setSecondsLeft(workSeconds);
  }, [elapsed, onComplete, phase, restSeconds, round, rounds, running, secondsLeft, workSeconds]);

  function handleReset() {
    setRunning(false);
    setPhase('work');
    setRound(1);
    setSecondsLeft(workSeconds);
    setElapsed(0);
  }

  return (
    <View style={styles.container}>
      <AppText variant="label" color="accent" align="center">
        {activity.label} · Round {Math.min(round, rounds)} / {rounds}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {phaseLabel}
      </AppText>
      <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
        {formatTime(Math.max(0, secondsLeft))}
      </AppText>
      <AppText variant="footnote" color="textSecondary" align="center">
        {workSeconds}s work · {restSeconds}s rest
      </AppText>

      <View style={styles.controls}>
        <PrimaryButton
          label={running ? 'Pause' : phase === 'done' ? 'Restart' : 'Start'}
          onPress={() => {
            if (phase === 'done') {
              handleReset();
              return;
            }
            setRunning((current) => !current);
          }}
        />
        <Pressable style={styles.secondaryButton} onPress={handleReset}>
          <AppText variant="bodyBold">Reset</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  controls: {
    gap: Spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});

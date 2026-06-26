import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useWatchCardioSync } from '@/hooks/useWatchCardioSync';
import {
    createIntervalTimerState,
    formatTimerSeconds,
    intervalPhaseLabel,
    resolveIntervalConfig,
    tickIntervalTimer,
} from '@/lib/timerEngine';

type IntervalTimerPanelProps = {
  activity: CardioActivity;
  sessionId: string;
  onComplete: (elapsedSeconds: number) => void;
};

export function IntervalTimerPanel({ activity, sessionId, onComplete }: IntervalTimerPanelProps) {
  const mode = activity.mode === 'tabata' ? 'tabata' : 'hiit';
  const [timer, setTimer] = useState(() =>
    createIntervalTimerState(mode, {
      workSeconds: activity.workSeconds,
      restSeconds: activity.restSeconds,
      rounds: activity.rounds,
    }),
  );
  const [elapsed, setElapsed] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!timer.running || timer.phase === 'done') return;
    const handle = setInterval(() => {
      setElapsed((current) => current + 1);
      setTimer((current) => tickIntervalTimer(current));
    }, 1000);
    return () => clearInterval(handle);
  }, [timer.running, timer.phase]);

  useEffect(() => {
    if (timer.phase !== 'done' || completedRef.current) return;
    completedRef.current = true;
    onComplete(elapsed);
  }, [elapsed, onComplete, timer.phase]);

  const config = resolveIntervalConfig(mode, timer.config);

  const { heartRateBpm } = useWatchCardioSync({
    sessionId,
    activityLabel: activity.label,
    activityType: activity.type,
    running: timer.running,
    elapsedSeconds: elapsed,
    phaseLabel: intervalPhaseLabel(timer.phase),
    enabled: timer.phase !== 'done',
  });

  function handleReset() {
    completedRef.current = false;
    setTimer(createIntervalTimerState(mode, config));
    setElapsed(0);
  }

  return (
    <View style={styles.container}>
      <AppText variant="label" color="accent" align="center">
        {activity.label} · Round {Math.min(timer.round, config.rounds)} / {config.rounds}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {intervalPhaseLabel(timer.phase)}
      </AppText>
      <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
        {formatTimerSeconds(Math.max(0, timer.secondsRemaining))}
      </AppText>
      <AppText variant="footnote" color="textSecondary" align="center">
        {config.workSeconds}s work · {config.restSeconds}s rest
        {heartRateBpm ? ` · ${heartRateBpm} bpm` : ''}
      </AppText>

      <View style={styles.controls}>
        <PrimaryButton
          label={timer.running ? 'Pause' : timer.phase === 'done' ? 'Restart' : 'Start'}
          onPress={() => {
            if (timer.phase === 'done') {
              handleReset();
              setTimer((current) => ({ ...current, running: true }));
              return;
            }
            setTimer((current) => ({ ...current, running: !current.running }));
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

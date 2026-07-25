import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
  advanceIntervalTimerToNow,
  createIntervalTimerState,
  formatTimerSeconds,
  intervalPhaseLabel,
  resolveIntervalConfig,
} from '@/lib/timerEngine';

const TICK_MS = 250;

type IntervalTimerPanelProps = {
  activity: CardioActivity;
  onComplete: (elapsedSeconds: number) => void;
};

export function IntervalTimerPanel({ activity, onComplete }: IntervalTimerPanelProps) {
  const mode = activity.mode === 'tabata' ? 'tabata' : 'hiit';
  const config = useMemo(
    () =>
      resolveIntervalConfig(mode, {
        workSeconds: activity.workSeconds,
        restSeconds: activity.restSeconds,
        rounds: activity.rounds,
      }),
    [activity.restSeconds, activity.rounds, activity.workSeconds, mode],
  );

  const [timer, setTimer] = useState(() => createIntervalTimerState(mode, config));
  const [elapsed, setElapsed] = useState(0);
  const deadlineRef = useRef<number | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const elapsedBaseRef = useRef(0);
  const completedRef = useRef(false);

  const readElapsed = useCallback(() => {
    const startedAt = runStartedAtRef.current;
    if (startedAt == null) return elapsedBaseRef.current;
    return elapsedBaseRef.current + Math.floor((Date.now() - startedAt) / 1000);
  }, []);

  /** Everything is derived from wall-clock deadlines so the timer can't drift or stall. */
  const resync = useCallback(() => {
    setElapsed(readElapsed());
    setTimer((current) => {
      if (!current.running || current.phase === 'done') return current;
      const deadline = deadlineRef.current;
      if (deadline == null) return current;

      const advanced = advanceIntervalTimerToNow(current, deadline, Date.now());
      if (advanced.state.phase === 'done') {
        deadlineRef.current = null;
        elapsedBaseRef.current = readElapsed();
        runStartedAtRef.current = null;
      } else {
        deadlineRef.current = advanced.deadlineMs;
      }
      return advanced.state;
    });
  }, [readElapsed]);

  useEffect(() => {
    if (!timer.running || timer.phase === 'done') return;
    const handle = setInterval(resync, TICK_MS);
    return () => clearInterval(handle);
  }, [resync, timer.phase, timer.running]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') resync();
    });
    return () => subscription.remove();
  }, [resync]);

  const handleReset = useCallback(
    (autoStart = false) => {
      const fresh = createIntervalTimerState(mode, config);
      elapsedBaseRef.current = 0;
      completedRef.current = false;
      setElapsed(0);
      if (autoStart) {
        const now = Date.now();
        runStartedAtRef.current = now;
        deadlineRef.current = now + fresh.secondsRemaining * 1000;
        setTimer({ ...fresh, running: true });
        return;
      }
      runStartedAtRef.current = null;
      deadlineRef.current = null;
      setTimer(fresh);
    },
    [config, mode],
  );

  useEffect(() => {
    handleReset();
  }, [handleReset]);

  useEffect(() => {
    if (timer.phase !== 'done' || completedRef.current) return;
    completedRef.current = true;
    onComplete(readElapsed());
  }, [onComplete, readElapsed, timer.phase]);

  const toggleRunning = useCallback(() => {
    setTimer((current) => {
      if (current.phase === 'done') return current;
      const now = Date.now();
      if (current.running) {
        elapsedBaseRef.current = readElapsed();
        runStartedAtRef.current = null;
        const deadline = deadlineRef.current;
        const remaining =
          deadline == null ? current.secondsRemaining : Math.max(0, Math.ceil((deadline - now) / 1000));
        deadlineRef.current = null;
        return { ...current, running: false, secondsRemaining: remaining };
      }
      runStartedAtRef.current = now;
      deadlineRef.current = now + current.secondsRemaining * 1000;
      return { ...current, running: true };
    });
  }, [readElapsed]);

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
        {config.workSeconds}s work · {config.restSeconds}s rest · {formatTimerSeconds(elapsed)} elapsed
      </AppText>

      <View style={styles.controls}>
        <PrimaryButton
          label={timer.running ? 'Pause' : timer.phase === 'done' ? 'Restart' : 'Start'}
          onPress={() => {
            if (timer.phase === 'done') handleReset(true);
            else toggleRunning();
          }}
        />
        <Pressable style={styles.secondaryButton} onPress={() => handleReset()}>
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

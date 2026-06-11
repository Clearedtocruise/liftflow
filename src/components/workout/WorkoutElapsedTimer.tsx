import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WorkoutSession } from '@/types';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type WorkoutElapsedTimerProps = {
  session: WorkoutSession;
  onPause: () => void;
  onResume: () => void;
};

export function WorkoutElapsedTimer({ session, onPause, onResume }: WorkoutElapsedTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const isPaused = session.status === 'paused';

  useEffect(() => {
    const started = new Date(session.startedAt).getTime();
    const tick = () => {
      if (isPaused) return;
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    };
    tick();
    if (isPaused) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt, isPaused]);

  const exercises = session.exercises ?? [];
  const activeEx = exercises.find((e) => e.isActive) ?? exercises[exercises.length - 1];
  const total = Math.max(exercises.length, 1);
  const index = activeEx ? exercises.findIndex((e) => e.id === activeEx.id) : exercises.length - 1;
  const position = Math.max(1, index + 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.timerRow}>
        <AppText variant="timer" color="primary" style={styles.timer}>
          {formatElapsed(elapsed)}
        </AppText>
        <Pressable
          onPress={isPaused ? onResume : onPause}
          style={styles.pauseBtn}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume workout' : 'Pause workout'}>
          <AppText variant="bodyBold" color="textPrimary">
            {isPaused ? 'Resume Workout' : 'Pause Workout'}
          </AppText>
        </Pressable>
      </View>
      <AppText variant="caption" color="textSecondary" align="center">
        {session.name} · Exercise {position}/{total}
        {activeEx?.exercise?.name ? ` · ${activeEx.exercise.name}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  timerRow: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  timer: {
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: 1,
  },
  pauseBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceHighlight,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});

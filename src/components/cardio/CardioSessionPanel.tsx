import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TextInput, View } from 'react-native';

import { IntervalTimerPanel } from '@/components/cardio/IntervalTimerPanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatCardioDuration } from '@/lib/exerciseModality';
import { parseDistanceToKm } from '@/lib/unitConversion';
import { cardioService } from '@/services/cardioService';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type CardioSessionPanelProps = {
  activity: CardioActivity;
};

export function CardioSessionPanel({ activity }: CardioSessionPanelProps) {
  const units = useUnits();
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [distanceText, setDistanceText] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savingRef = useRef(false);
  const runStartedAtRef = useRef<number | null>(null);
  const elapsedBaseRef = useRef(0);

  const readElapsed = useCallback(() => {
    const startedAt = runStartedAtRef.current;
    if (startedAt == null) return elapsedBaseRef.current;
    return elapsedBaseRef.current + Math.floor((Date.now() - startedAt) / 1000);
  }, []);

  useEffect(() => {
    if (!running || activity.mode !== 'steady') return;
    const timer = setInterval(() => setElapsed(readElapsed()), 250);
    return () => clearInterval(timer);
  }, [activity.mode, readElapsed, running]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setElapsed(readElapsed());
    });
    return () => subscription.remove();
  }, [readElapsed]);

  const persistSession = useCallback(
    async (durationSeconds: number, distanceMeters?: number) => {
      if (savingRef.current) return;
      if (!user?.id) {
        setSaveState('error');
        return;
      }
      if (durationSeconds <= 0) return;

      savingRef.current = true;
      setSaveState('saving');
      const result = await cardioService.logSession({
        userId: user.id,
        cardioType: activity.type,
        durationSeconds,
        distanceMeters,
      });
      savingRef.current = false;
      setSaveState(result.success ? 'saved' : 'error');
    },
    [activity.type, user?.id],
  );

  const handleIntervalComplete = useCallback(
    (seconds: number) => {
      elapsedBaseRef.current = seconds;
      runStartedAtRef.current = null;
      setElapsed(seconds);
      setCompleted(true);
      void persistSession(seconds);
    },
    [persistSession],
  );

  if (activity.mode === 'tabata' || activity.mode === 'interval') {
    return (
      <View style={styles.stack}>
        <IntervalTimerPanel key={activity.id} activity={activity} onComplete={handleIntervalComplete} />
        {saveState !== 'idle' ? (
          <AppText variant="footnote" color={saveState === 'error' ? 'accent' : 'textSecondary'} align="center">
            {saveState === 'saving'
              ? 'Saving session…'
              : saveState === 'saved'
                ? `Logged ${formatCardioDuration(elapsed)}`
                : 'Could not save this session — check your connection and finish again.'}
          </AppText>
        ) : null}
      </View>
    );
  }

  const distanceKm = parseDistanceToKm(distanceText, units.preferredDistanceUnit) ?? 0;
  const distanceLabel = units.preferredDistanceUnit === 'km' ? 'km' : 'mi';

  return (
    <View style={styles.steadyCard}>
      <AppText variant="label" color="accent" align="center">
        {activity.label}
      </AppText>
      <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
        {formatCardioDuration(elapsed)}
      </AppText>

      {completed || !running ? (
        <View style={styles.distanceBlock}>
          <AppText variant="caption" color="textSecondary">
            Distance ({distanceLabel})
          </AppText>
          <TextInput
            style={styles.distanceInput}
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="decimal-pad"
            placeholder={`0.0 ${distanceLabel}`}
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
        </View>
      ) : null}

      <AppText variant="footnote" color={saveState === 'error' ? 'accent' : 'textSecondary'} align="center">
        {saveState === 'saving'
          ? 'Saving session…'
          : saveState === 'error'
            ? 'Could not save this session — check your connection and finish again.'
            : completed
              ? `${saveState === 'saved' ? 'Logged' : 'Finished'} ${formatCardioDuration(elapsed)} · ${units.formatDistance(distanceKm)}`
              : running
                ? 'Session in progress'
                : 'Ready when you are'}
      </AppText>
      <PrimaryButton
        label={running ? 'Pause' : completed ? 'Restart' : 'Start'}
        onPress={() => {
          if (completed) {
            elapsedBaseRef.current = 0;
            runStartedAtRef.current = Date.now();
            setElapsed(0);
            setCompleted(false);
            setSaveState('idle');
            setDistanceText('');
            setRunning(true);
            return;
          }
          if (running) {
            elapsedBaseRef.current = readElapsed();
            runStartedAtRef.current = null;
            setElapsed(elapsedBaseRef.current);
            setRunning(false);
            return;
          }
          runStartedAtRef.current = Date.now();
          setRunning(true);
        }}
      />
      {running || (completed && saveState === 'error') ? (
        <PrimaryButton
          label={saveState === 'error' ? 'Retry save' : 'Finish'}
          variant="secondary"
          onPress={() => {
            const total = readElapsed();
            elapsedBaseRef.current = total;
            runStartedAtRef.current = null;
            setElapsed(total);
            setRunning(false);
            setCompleted(true);
            void persistSession(total, distanceKm > 0 ? Math.round(distanceKm * 1000) : undefined);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.sm,
  },
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
  distanceBlock: {
    gap: Spacing.xs,
  },
  distanceInput: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
});

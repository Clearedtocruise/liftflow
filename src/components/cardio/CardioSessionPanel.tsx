import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { IntervalTimerPanel } from '@/components/cardio/IntervalTimerPanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { formatCardioDuration } from '@/lib/exerciseModality';
import { parseDistanceToKm } from '@/lib/unitConversion';

type CardioSessionPanelProps = {
  activity: CardioActivity;
};

export function CardioSessionPanel({ activity }: CardioSessionPanelProps) {
  const units = useUnits();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [distanceText, setDistanceText] = useState('');

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

      <AppText variant="footnote" color="textSecondary" align="center">
        {completed
          ? `Logged ${formatCardioDuration(elapsed)} · ${units.formatDistance(distanceKm)}`
          : running
            ? 'Session in progress'
            : 'Ready when you are'}
      </AppText>
      <PrimaryButton
        label={running ? 'Pause' : completed ? 'Restart' : 'Start'}
        onPress={() => {
          if (completed) {
            setElapsed(0);
            setCompleted(false);
            setDistanceText('');
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

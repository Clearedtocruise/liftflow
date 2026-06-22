import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ActivitySessionSaveCard } from '@/components/cardio/ActivitySessionSaveCard';
import { IntervalTimerPanel } from '@/components/cardio/IntervalTimerPanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { estimateActivityCalories } from '@/lib/activityCalories';
import { formatCardioDuration } from '@/lib/exerciseModality';
import { parseDistanceToKm } from '@/lib/unitConversion';
import { cardioService } from '@/services/cardioService';

type CardioSessionPanelProps = {
  activity: CardioActivity;
  activityKind?: 'cardio' | 'conditioning' | 'walk';
};

export function CardioSessionPanel({ activity, activityKind }: CardioSessionPanelProps) {
  const { user } = useAuth();
  const units = useUnits();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [distanceText, setDistanceText] = useState('');
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running || activity.mode !== 'steady') return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [activity.mode, running]);

  const distanceKm = parseDistanceToKm(distanceText, units.preferredDistanceUnit) ?? 0;
  const distanceLabel = units.preferredDistanceUnit === 'km' ? 'km' : 'mi';
  const distanceMeters = distanceKm > 0 ? Math.round(distanceKm * 1000) : undefined;

  const kind =
    activityKind ?? (activity.type === 'walk' ? 'walk' : activity.mode === 'steady' ? 'cardio' : 'conditioning');

  async function saveSession(durationSeconds: number) {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to save this activity.');
      return;
    }
    if (durationSeconds < 30) {
      Alert.alert('Too short', 'Record at least 30 seconds before saving.');
      return;
    }

    setSaving(true);
    const startedAt = startedAtRef.current ?? Date.now() - durationSeconds * 1000;
    const { calories, met, weightKg } = estimateActivityCalories({
      durationSeconds,
      weightKg: user.weightKg,
      cardioType: activity.type,
      distanceMeters,
      activityLabel: activity.label,
    });

    const result = await cardioService.logSession({
      userId: user.id,
      cardioType: activity.type,
      durationSeconds,
      distanceMeters,
      caloriesBurned: calories,
      startedAt: new Date(startedAt).toISOString(),
      activityKind: kind,
      intensity: activity.mode === 'tabata' || activity.mode === 'interval' ? 'high' : 'moderate',
      notes: activity.label,
      metadata: { met, estimatedCalories: true, weightKgUsed: weightKg },
    });

    setSaving(false);
    if (result.success) {
      Alert.alert(
        'Activity saved',
        `${activity.label} · ${formatCardioDuration(durationSeconds)} · ~${calories} cal`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } else {
      Alert.alert('Could not save', result.error);
    }
  }

  function resetSession() {
    setRunning(false);
    setElapsed(0);
    setCompleted(false);
    setDistanceText('');
    startedAtRef.current = null;
  }

  if (completed && elapsed > 0) {
    const { calories, weightKg } = estimateActivityCalories({
      durationSeconds: elapsed,
      weightKg: user?.weightKg,
      cardioType: activity.type,
      distanceMeters,
    });
    const usedDefaultWeight = !user?.weightKg;

    return (
      <ActivitySessionSaveCard
        activityLabel={activity.label}
        durationSeconds={elapsed}
        distanceLabel={distanceMeters ? units.formatDistance(distanceKm) : undefined}
        estimatedCalories={calories}
        usedDefaultWeight={usedDefaultWeight}
        saving={saving}
        onSave={() => void saveSession(elapsed)}
        onDiscard={resetSession}
      />
    );
  }

  if (activity.mode === 'tabata' || activity.mode === 'interval') {
    return (
      <IntervalTimerPanel
        activity={activity}
        onComplete={(seconds) => {
          startedAtRef.current = Date.now() - seconds * 1000;
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
        {formatCardioDuration(elapsed)}
      </AppText>

      {!running ? (
        <View style={styles.distanceBlock}>
          <AppText variant="caption" color="textSecondary">
            Distance ({distanceLabel}, optional)
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
        {running ? 'Session in progress' : 'Tap Start when you begin'}
      </AppText>

      <PrimaryButton
        label={running ? 'Pause' : 'Start'}
        onPress={() => {
          if (running) {
            setRunning(false);
            return;
          }
          if (!startedAtRef.current) {
            startedAtRef.current = Date.now();
          }
          setRunning(true);
          setCompleted(false);
        }}
      />

      {elapsed > 0 && !running ? (
        <PrimaryButton
          label="Finish & save"
          variant="secondary"
          onPress={() => {
            setRunning(false);
            setCompleted(true);
          }}
        />
      ) : null}

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

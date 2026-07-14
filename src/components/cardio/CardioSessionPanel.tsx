import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ActivitySessionSaveCard } from '@/components/cardio/ActivitySessionSaveCard';
import { HeartRateZoneBars } from '@/components/cardio/HeartRateZoneBars';
import { IntervalTimerPanel } from '@/components/cardio/IntervalTimerPanel';
import { SteadyCardioMetrics } from '@/components/cardio/SteadyCardioMetrics';
import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import type { CardioActivity } from '@/constants/cardioActivities';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCardioLocationTracking } from '@/hooks/useCardioLocationTracking';
import { useCardioSessionClock } from '@/hooks/useCardioSessionClock';
import { useUnits } from '@/hooks/useUnits';
import { useWatchCardioSync } from '@/hooks/useWatchCardioSync';
import { estimateActivityCalories } from '@/lib/activityCalories';
import {
    formatLiveDistance,
    formatPace,
    formatSpeed,
    supportsSteadyDistanceMetrics,
} from '@/lib/cardioMetrics';
import { formatCardioDuration } from '@/lib/exerciseModality';
import {
    ageFromDateOfBirth,
    buildHeartRateZoneBuckets,
} from '@/lib/heartRateZones';
import { parseDistanceToKm } from '@/lib/unitConversion';
import { cardioService } from '@/services/cardioService';
import { watchCardioBridge } from '@/state/watchCardioBridge';

type CardioSessionPanelProps = {
  activity: CardioActivity;
  activityKind?: 'cardio' | 'conditioning' | 'walk';
};

export function CardioSessionPanel({ activity, activityKind }: CardioSessionPanelProps) {
  const { user } = useAuth();
  const units = useUnits();
  const [completed, setCompleted] = useState(false);
  const [distanceText, setDistanceText] = useState('');
  const [saving, setSaving] = useState(false);
  const sessionIdRef = useRef(`cardio-${activity.id}`);
  const heartRateSamplesRef = useRef<Array<{ bpm: number; recordedAt: string }>>([]);

  const tracksDistance = supportsSteadyDistanceMetrics(activity.type);
  const {
    running,
    elapsed,
    start,
    pause,
    reset,
    getStartedAt,
    getElapsedForSave,
    getSessionStartedAtIso,
    persist,
  } = useCardioSessionClock({
    persistence: {
      sessionId: sessionIdRef.current,
      activityId: activity.id,
      activityLabel: activity.label,
      activityType: activity.type,
      activityMode: activity.mode,
    },
    onRestore: (saved) => {
      if (saved.distanceMeters > 0) {
        setDistanceText('');
      }
    },
  });

  const { distanceMeters: trackedMeters, status: gpsStatus, reset: resetGps } = useCardioLocationTracking(
    running && tracksDistance,
  );

  useEffect(() => {
    if (!getStartedAt()) return;
    void persist(trackedMeters);
  }, [trackedMeters, running, elapsed, persist, getStartedAt]);

  useEffect(() => {
    return watchCardioBridge.subscribeCommands((command) => {
      if (command === 'pause') pause();
      if (command === 'resume') start();
      if (command === 'finish') {
        pause();
        setCompleted(true);
      }
    });
  }, [pause, start]);

  const manualDistanceKm = parseDistanceToKm(distanceText, units.preferredDistanceUnit) ?? 0;
  const manualDistanceMeters = manualDistanceKm > 0 ? Math.round(manualDistanceKm * 1000) : 0;
  const effectiveDistanceMeters = manualDistanceMeters > 0 ? manualDistanceMeters : trackedMeters;
  const distanceLabel = units.preferredDistanceUnit === 'km' ? 'km' : 'mi';

  const kind =
    activityKind ?? (activity.type === 'walk' ? 'walk' : activity.mode === 'steady' ? 'cardio' : 'conditioning');

  const calorieEstimate = estimateActivityCalories({
    durationSeconds: elapsed,
    weightKg: user?.weightKg,
    cardioType: activity.type,
    distanceMeters: effectiveDistanceMeters > 0 ? effectiveDistanceMeters : undefined,
    activityLabel: activity.label,
  });

  const liveDistanceLabel = formatLiveDistance(effectiveDistanceMeters, units.preferredDistanceUnit);
  const paceLabel = formatPace(elapsed, effectiveDistanceMeters, units.preferredDistanceUnit);
  const speedLabel = formatSpeed(elapsed, effectiveDistanceMeters, units.preferredDistanceUnit);
  const usedDefaultWeight = !user?.weightKg;

  const { heartRateBpm } = useWatchCardioSync({
    sessionId: sessionIdRef.current,
    activityLabel: activity.label.toUpperCase(),
    activityType: activity.type,
    running,
    elapsedSeconds: elapsed,
    sessionStartedAt: getSessionStartedAtIso(),
    distanceMeters: effectiveDistanceMeters > 0 ? effectiveDistanceMeters : undefined,
    paceLabel,
    speedLabel,
    calories: calorieEstimate.calories,
    enabled: !completed && activity.mode === 'steady',
  });

  useEffect(() => {
    if (heartRateBpm) {
      heartRateSamplesRef.current.push({
        bpm: heartRateBpm,
        recordedAt: new Date().toISOString(),
      });
    }
  }, [heartRateBpm]);

  const intervalSavedRef = useRef(false);
  const userAge = ageFromDateOfBirth(user?.dateOfBirth);

  async function saveSession(durationSeconds: number) {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to save this activity.');
      return;
    }
    if (saving) return;
    if (durationSeconds < 30) {
      Alert.alert('Too short', 'Record at least 30 seconds before saving.');
      return;
    }

    setSaving(true);
    const startedAt = getStartedAt() ?? Date.now() - durationSeconds * 1000;
    const distanceMeters = effectiveDistanceMeters > 0 ? effectiveDistanceMeters : undefined;
    const samples = heartRateSamplesRef.current;
    const avgHeartRate =
      samples.length > 0
        ? Math.round(samples.reduce((sum, sample) => sum + sample.bpm, 0) / samples.length)
        : undefined;

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
      avgHeartRate,
      startedAt: new Date(startedAt).toISOString(),
      activityKind: kind,
      intensity: activity.mode === 'tabata' || activity.mode === 'interval' ? 'high' : 'moderate',
      notes: activity.label,
      metadata: {
        met,
        estimatedCalories: true,
        weightKgUsed: weightKg,
        avgPace: paceLabel,
        avgSpeed: speedLabel,
        gpsTracked: trackedMeters > 0 && manualDistanceMeters === 0,
        avgHeartRateBpm: avgHeartRate,
        heartRateZones: buildHeartRateZoneBuckets(samples, userAge).map((zone) => ({
          zone: zone.zone,
          seconds: Math.round(zone.seconds),
        })),
      },
    });

    setSaving(false);
    if (result.success) {
      reset();
      resetGps();
      heartRateSamplesRef.current = [];
      const summary = [
        formatCardioDuration(durationSeconds),
        effectiveDistanceMeters > 0 ? liveDistanceLabel : null,
        `~${calories} cal`,
      ]
        .filter(Boolean)
        .join(' · ');
      Alert.alert('Activity saved', `${activity.label} · ${summary}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Could not save', result.error);
    }
  }

  function handleFinish() {
    pause();
    setCompleted(true);
  }

  function handleReset() {
    reset();
    resetGps();
    setCompleted(false);
    setDistanceText('');
    heartRateSamplesRef.current = [];
    intervalSavedRef.current = false;
  }

  if (completed && elapsed > 0) {
    const saveDuration = getElapsedForSave();
    return (
      <ActivitySessionSaveCard
        activityLabel={activity.label}
        durationSeconds={saveDuration}
        distanceLabel={effectiveDistanceMeters > 0 ? liveDistanceLabel : undefined}
        paceLabel={paceLabel}
        speedLabel={speedLabel}
        estimatedCalories={estimateActivityCalories({
          durationSeconds: saveDuration,
          weightKg: user?.weightKg,
          cardioType: activity.type,
          distanceMeters: effectiveDistanceMeters > 0 ? effectiveDistanceMeters : undefined,
          activityLabel: activity.label,
        }).calories}
        usedDefaultWeight={usedDefaultWeight}
        heartRateBpm={heartRateBpm}
        heartRateZones={buildHeartRateZoneBuckets(heartRateSamplesRef.current, userAge)}
        saving={saving}
        showDistanceEdit={tracksDistance}
        distanceText={distanceText}
        distanceUnitLabel={distanceLabel}
        onDistanceChange={setDistanceText}
        onSave={() => void saveSession(getElapsedForSave())}
        onDiscard={handleReset}
      />
    );
  }

  if (activity.mode === 'tabata' || activity.mode === 'interval') {
    return (
      <IntervalTimerPanel
        activity={activity}
        sessionId={sessionIdRef.current}
        onComplete={(seconds) => {
          if (intervalSavedRef.current) return;
          intervalSavedRef.current = true;
          setCompleted(true);
          void saveSession(seconds);
        }}
      />
    );
  }

  const activityTitle = activity.type === 'run' ? 'RUN' : activity.label.toUpperCase();
  const showManualDistance = tracksDistance && !running && elapsed > 0;
  const liveZones = buildHeartRateZoneBuckets(heartRateSamplesRef.current, userAge);
  const hasLiveZones = liveZones.some((zone) => zone.seconds > 0);

  return (
    <GradientBorderCard intensity="subtle" innerStyle={styles.steadyCard}>
      <AppText variant="label" color="accent" align="center" style={styles.activityTitle}>
        {activityTitle}
      </AppText>

      <AppText variant="timer" color="restTimer" align="center" style={styles.timer}>
        {formatCardioDuration(elapsed)}
      </AppText>

      {(running || elapsed > 0) && (
        <SteadyCardioMetrics
          distanceLabel={liveDistanceLabel}
          paceLabel={paceLabel}
          speedLabel={speedLabel}
          calories={calorieEstimate.calories}
          usedDefaultWeight={usedDefaultWeight}
          heartRateBpm={heartRateBpm}
          gpsStatus={running ? gpsStatus : undefined}
          compact
        />
      )}

      {hasLiveZones ? <HeartRateZoneBars zones={liveZones} /> : null}

      {showManualDistance ? (
        <View style={styles.distanceBlock}>
          <AppText variant="caption" color="textSecondary">
            Distance ({distanceLabel}, optional)
          </AppText>
          <TextInput
            style={styles.distanceInput}
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="decimal-pad"
            placeholder={trackedMeters > 0 ? liveDistanceLabel : `0.0 ${distanceLabel}`}
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
          onPress={() => {
            if (running) pause();
            else start();
            setCompleted(false);
          }}
        />
        {elapsed > 0 ? (
          <PrimaryButton label="Finish" variant="secondary" onPress={handleFinish} />
        ) : null}
      </View>

      {running ? (
        <AppText variant="footnote" color="textTertiary" align="center">
          Tracking continues when your screen locks or you switch apps
        </AppText>
      ) : null}
    </GradientBorderCard>
  );
}

const styles = StyleSheet.create({
  steadyCard: {
    gap: Spacing.lg,
  },
  activityTitle: {
    letterSpacing: 2,
  },
  timer: {
    fontVariant: ['tabular-nums'],
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
  actions: {
    gap: Spacing.sm,
  },
});

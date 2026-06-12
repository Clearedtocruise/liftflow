import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExerciseCompleteCard } from '@/components/workout/execution/ExerciseCompleteCard';
import { RestTimerOverlay } from '@/components/workout/execution/RestTimerOverlay';
import { SetLoggingControls } from '@/components/workout/execution/SetLoggingControls';
import { SmartProgressionCard } from '@/components/workout/SmartProgressionCard';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutElapsed, useWorkoutElapsedSeconds } from '@/hooks/useWorkoutElapsedSeconds';
import {
    defaultTimedDurationSeconds,
    formatSetLoggedLabel,
    getExerciseLoggingMode,
} from '@/lib/exerciseModality';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { parseTargetReps } from '@/lib/workoutPlan';
import { workoutService } from '@/services/workoutService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { WorkoutSession } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type ActiveWorkoutScreenProps = {
  session: WorkoutSession;
  planExercises: EditableWorkoutExercise[];
  onFinish: () => void;
  onCancel: () => void;
};

export function ActiveWorkoutScreen({ session, planExercises, onFinish, onCancel }: ActiveWorkoutScreenProps) {
  const { user } = useAuth();
  const units = useUnits();
  const {
    restSecondsRemaining,
    activeRestPeriod,
    pauseSession,
    resumeSession,
    logSet,
    pauseRestTimer,
    resumeRestTimer,
    adjustRestTimer,
    setRestTimer,
    skipRestTimer,
    refreshSession,
  } = useWorkoutSession();

  const elapsedSeconds = useWorkoutElapsedSeconds(session.startedAt, session.status);

  const sortedExercises = useMemo(
    () => [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder),
    [session.exercises],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [reps, setReps] = useState(8);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [logging, setLogging] = useState(false);
  const [historySets, setHistorySets] = useState<Array<{ weightKg: number; reps: number }>>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [exerciseHadPr, setExerciseHadPr] = useState(false);
  const [restPaused, setRestPaused] = useState(false);
  const [restTargetSeconds, setRestTargetSeconds] = useState(DEFAULT_REST_SECONDS);

  const currentExercise = sortedExercises[currentIndex];
  const planMeta = planExercises[currentIndex] ?? planExercises.find(
    (item) => item.name.toLowerCase() === currentExercise?.exercise?.name?.toLowerCase(),
  );
  const targetSets = planMeta?.sets ?? 3;
  const repRange = planMeta?.repRange ?? currentExercise?.suggestedReps ?? '8-10';
  const completedSets = currentExercise?.sets ?? [];
  const isPaused = session.status === 'paused';
  const restActive = restSecondsRemaining !== null && restSecondsRemaining > 0;
  const allSetsDone = completedSets.length >= targetSets;
  const isLastExercise = currentIndex >= sortedExercises.length - 1;
  const nextExercise = sortedExercises[currentIndex + 1];
  const nextPlanMeta = planExercises[currentIndex + 1];
  const loggingMode = getExerciseLoggingMode(
    currentExercise?.exercise,
    repRange,
    currentExercise?.exercise?.name,
  );
  const nextSetNumber = Math.min(completedSets.length + 1, targetSets);
  const currentSessionSets = useMemo(
    () =>
      completedSets.map((set, index) => ({
        weightKg: set.weight ?? 0,
        reps: set.reps ?? 0,
        setNumber: index + 1,
      })),
    [completedSets],
  );

  const handleApplyCoachTarget = useCallback(
    (recommended: { weightKg: number; reps: number }) => {
      if (loggingMode === 'bodyweight') {
        setReps(recommended.reps);
        return;
      }
      if (loggingMode === 'weighted' && recommended.weightKg > 0) {
        setWeightKg(recommended.weightKg);
        setReps(recommended.reps);
      }
    },
    [loggingMode],
  );

  useEffect(() => {
    if (restSecondsRemaining === 0) {
      setRestPaused(false);
    }
  }, [restSecondsRemaining]);

  useEffect(() => {
    const nextRest = planMeta?.restSeconds ?? DEFAULT_REST_SECONDS;
    setRestTargetSeconds(nextRest);
  }, [currentExercise?.id, planMeta?.restSeconds]);

  useEffect(() => {
    if (!user || !currentExercise?.exerciseId) return;

    const mode = getExerciseLoggingMode(
      currentExercise.exercise,
      repRange,
      currentExercise.exercise?.name,
    );
    setDurationSeconds(defaultTimedDurationSeconds(repRange));

    let cancelled = false;
    void workoutService.getRecentSetsForExercise(user.id, currentExercise.exerciseId, 5).then((result) => {
      if (cancelled || !result.success) return;
      setHistorySets(result.data);

      const last = result.data[0];
      if (mode === 'timed') {
        setReps(1);
        return;
      }
      if (mode === 'bodyweight') {
        setReps(last?.reps ?? parseTargetReps(repRange));
        return;
      }
      if (last) {
        setWeightKg(last.weightKg);
        setReps(last.reps);
      } else if (currentExercise.suggestedWeight) {
        setWeightKg(currentExercise.suggestedWeight);
        setReps(parseTargetReps(repRange));
      } else {
        setReps(parseTargetReps(repRange));
      }
    });

    setShowComplete(false);
    setExerciseHadPr(false);

    return () => {
      cancelled = true;
    };
  }, [currentExercise?.id, currentExercise?.exerciseId, currentExercise?.exercise, currentExercise?.suggestedWeight, repRange, user]);

  useEffect(() => {
    if (allSetsDone && completedSets.length > 0) {
      setShowComplete(true);
      setExerciseHadPr(completedSets.some((set) => set.isPr));
    }
  }, [allSetsDone, completedSets]);

  const exerciseVolume = completedSets.reduce((total, set) => {
    if (!set.weight || !set.reps) return total;
    return total + set.weight * set.reps;
  }, 0);

  async function handleLogSet() {
    if (!currentExercise || isPaused || allSetsDone) return;

    setLogging(true);
    const base = {
      workoutExerciseId: currentExercise.id,
      restSeconds: restTargetSeconds,
    };

    const logged =
      loggingMode === 'timed'
        ? await logSet({ ...base, durationSeconds, reps: 1 })
        : loggingMode === 'bodyweight'
          ? await logSet({ ...base, reps })
          : await logSet({ ...base, weight: weightKg, reps });
    setLogging(false);

    if (logged?.isPr) {
      setExerciseHadPr(true);
    }

    await refreshSession();
  }

  function handleNextExercise() {
    if (isLastExercise) {
      onFinish();
      return;
    }
    setCurrentIndex((index) => index + 1);
    setShowComplete(false);
  }

  function handlePauseRest() {
    pauseRestTimer();
    setRestPaused(true);
  }

  function handleResumeRest() {
    resumeRestTimer();
    setRestPaused(false);
  }

  async function handleSkipRest() {
    await skipRestTimer();
    setRestPaused(false);
  }

  if (!currentExercise) {
    return (
      <ScreenContainer>
        <AppText variant="body" color="textSecondary">
          No exercises in this session.
        </AppText>
        <PrimaryButton label="Finish" onPress={onFinish} />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenContainer contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <View style={styles.headerMeta}>
              <AppText variant="caption" color="accent">
                Exercise {currentIndex + 1} of {sortedExercises.length}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {formatWorkoutElapsed(elapsedSeconds)}
              </AppText>
            </View>
            <AppText variant="title">{session.name}</AppText>
          </View>
          <View style={styles.headerActions}>
            {isPaused ? (
              <PrimaryButton label="Resume" onPress={resumeSession} />
            ) : (
              <PrimaryButton label="Pause" variant="secondary" onPress={pauseSession} />
            )}
          </View>
        </View>

        <View style={styles.heroOuter}>
          <LinearGradient colors={['rgba(31, 107, 255, 0.35)', 'rgba(0, 229, 255, 0.12)']} style={styles.heroBorder}>
            <View style={styles.heroCard}>
              <AppText variant="headline" style={styles.exerciseName}>
                {(currentExercise.exercise?.name ?? 'Exercise').toUpperCase()}
              </AppText>

              <AppText variant="footnote" color="textSecondary">
                {loggingMode === 'timed'
                  ? `Target ${targetSets} sets · ${repRange}`
                  : loggingMode === 'bodyweight'
                    ? `Target ${targetSets} sets · ${repRange} reps · Bodyweight`
                    : `Target ${targetSets} sets · ${repRange} reps · Rest ${restTargetSeconds}s`}
              </AppText>

              {user && currentExercise.exerciseId && loggingMode !== 'timed' && !showComplete ? (
                <SmartProgressionCard
                  variant="inline"
                  loggingMode={loggingMode}
                  userId={user.id}
                  exerciseId={currentExercise.exerciseId}
                  exerciseName={currentExercise.exercise?.name ?? 'Exercise'}
                  sessionId={session.id}
                  currentSessionSets={currentSessionSets}
                  onApplyTarget={handleApplyCoachTarget}
                />
              ) : null}

              <View style={styles.restPresetRow}>
                {[60, 90, 120, 150].map((seconds) => (
                  <Pressable key={seconds} onPress={() => setRestTargetSeconds(seconds)}>
                    <AppText variant="caption" color={restTargetSeconds === seconds ? 'accent' : 'textSecondary'}>
                      {seconds}s rest
                    </AppText>
                  </Pressable>
                ))}
              </View>

              {historySets.length > 0 && loggingMode === 'weighted' ? (
                <View style={styles.historyBlock}>
                  <AppText variant="label" color="textSecondary">
                    Previous Performance
                  </AppText>
                  {historySets.slice(0, 3).map((set, index) => (
                    <AppText key={`${set.weightKg}-${set.reps}-${index}`} variant="footnote" color="textSecondary">
                      {formatWorkoutWeightForInput(set.weightKg, units.preferredWeightUnit)} {units.weightLabel} × {set.reps}
                    </AppText>
                  ))}
                </View>
              ) : null}

              {historySets.length > 0 && loggingMode === 'bodyweight' ? (
                <View style={styles.historyBlock}>
                  <AppText variant="label" color="textSecondary">
                    Previous Performance
                  </AppText>
                  {historySets.slice(0, 3).map((set, index) => (
                    <AppText key={`${set.reps}-${index}`} variant="footnote" color="textSecondary">
                      {set.reps} reps
                    </AppText>
                  ))}
                </View>
              ) : null}

              {!showComplete ? (
                <>
                  <SetLoggingControls
                    mode={loggingMode}
                    weightKg={weightKg}
                    reps={reps}
                    durationSeconds={durationSeconds}
                    onChangeWeight={setWeightKg}
                    onChangeReps={setReps}
                    onChangeDuration={setDurationSeconds}
                    disabled={isPaused || logging}
                  />
                  <PrimaryButton
                    label={allSetsDone ? 'All sets logged' : `Log Set · Set ${nextSetNumber} of ${targetSets}`}
                    size="large"
                    loading={logging}
                    disabled={isPaused || allSetsDone}
                    onPress={handleLogSet}
                  />
                </>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        <Card style={styles.setProgress}>
          {Array.from({ length: targetSets }).map((_, index) => {
            const set = completedSets[index];
            const pending = !set;
            return (
              <View key={`set-${index + 1}`} style={styles.setRow}>
                <AppText variant="bodyBold" color={pending ? 'textTertiary' : 'textPrimary'}>
                  Set {index + 1} {pending ? 'Pending' : '✓'}
                </AppText>
                {!pending ? (
                  <AppText variant="footnote" color="textSecondary">
                    {formatSetLoggedLabel(
                      loggingMode,
                      set,
                      (kg) => formatWorkoutWeightForInput(kg, units.preferredWeightUnit),
                      units.weightLabel,
                    )}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </Card>

        {!showComplete && nextExercise ? (
          <Card style={styles.nextPreview}>
            <AppText variant="label" color="textSecondary">
              Next exercise
            </AppText>
            <AppText variant="bodyBold">{nextExercise.exercise?.name ?? 'Up next'}</AppText>
          </Card>
        ) : null}

        {showComplete ? (
          <ExerciseCompleteCard
            volumeKg={exerciseVolume}
            hasPr={exerciseHadPr}
            onNext={handleNextExercise}
            isLastExercise={isLastExercise}
          />
        ) : null}

        <View style={styles.footerActions}>
          <PrimaryButton label="Finish Workout" variant="secondary" onPress={onFinish} />
          <PrimaryButton
            label="Cancel Workout"
            variant="ghost"
            onPress={() =>
              Alert.alert('Cancel workout', 'Discard this session?', [
                { text: 'Keep going', style: 'cancel' },
                { text: 'Cancel workout', style: 'destructive', onPress: onCancel },
              ])
            }
          />
        </View>
      </ScreenContainer>

      <RestTimerOverlay
        visible={restActive && !showComplete}
        secondsRemaining={restSecondsRemaining}
        recommendedSeconds={activeRestPeriod?.recommendedSeconds ?? restTargetSeconds}
        isPaused={restPaused}
        onPause={handlePauseRest}
        onResume={handleResumeRest}
        onSkip={handleSkipRest}
        onAdjust={adjustRestTimer}
        onSetRest={setRestTimer}
        nextExerciseName={nextExercise?.exercise?.name}
        nextExerciseDetail={
          nextPlanMeta
            ? `${nextPlanMeta.sets} sets · ${nextPlanMeta.repRange ?? '8-10'} reps`
            : nextExercise?.suggestedReps
              ? `${nextExercise.suggestedReps} reps`
              : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  content: {
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerMain: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerActions: {
    minWidth: 96,
  },
  heroOuter: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  heroBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  heroCard: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  exerciseName: {
    letterSpacing: 1,
  },
  nextPreview: {
    gap: Spacing.xs,
  },
  historyBlock: {
    gap: Spacing.xs,
  },
  restPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  setProgress: {
    gap: Spacing.sm,
  },
  setRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  footerActions: {
    gap: Spacing.sm,
  },
});

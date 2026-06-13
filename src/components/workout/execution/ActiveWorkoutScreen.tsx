import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExerciseCompleteCard } from '@/components/workout/execution/ExerciseCompleteCard';
import { GuidedWorkoutMetrics, WorkoutProgressBar } from '@/components/workout/execution/GuidedWorkoutMetrics';
import { RestTimerOverlay } from '@/components/workout/execution/RestTimerOverlay';
import { SetLoggingControls } from '@/components/workout/execution/SetLoggingControls';
import { WorkoutChallengeModal } from '@/components/workout/execution/WorkoutChallengeModal';
import { ExerciseCoachCard } from '@/components/workout/ExerciseCoachCard';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutClockTime, useWorkoutElapsedSeconds } from '@/hooks/useWorkoutElapsedSeconds';
import {
    computeWorkoutSetProgress,
    formatCoachTargetLine,
} from '@/lib/activeWorkoutMetrics';
import {
    defaultTimedDurationSeconds,
    formatSetLoggedLabel,
    getExerciseLoggingMode,
} from '@/lib/exerciseModality';
import {
    getSupersetGroupForIndex,
    getSupersetLabel,
    isSupersetGroupComplete,
    nextExerciseIndexAfterGroup,
    resolvePostSetSupersetAction,
} from '@/lib/supersetFlow';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { pickWorkoutChallenge } from '@/lib/workoutChallengeFlow';
import { parseTargetReps } from '@/lib/workoutPlan';
import { workoutService } from '@/services/workoutService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { WorkoutSession } from '@/types';
import type {
    WorkoutChallengeRecord,
    WorkoutChallengeTemplate,
    WorkoutChallengeTrigger,
} from '@/types/workoutChallenge';
import type { EditableWorkoutExercise, ExerciseHistorySet } from '@/types/workoutExecution';
import type { ExerciseCoachPrescription } from '@/types/exerciseCoach';

type ActiveWorkoutScreenProps = {
  session: WorkoutSession;
  planExercises: EditableWorkoutExercise[];
  challengeRecords: WorkoutChallengeRecord[];
  onChallengeRecord: (record: WorkoutChallengeRecord) => void;
  onFinish: () => void;
  onCancel: () => void;
};

export function ActiveWorkoutScreen({
  session,
  planExercises,
  challengeRecords,
  onChallengeRecord,
  onFinish,
  onCancel,
}: ActiveWorkoutScreenProps) {
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
  const [historySets, setHistorySets] = useState<ExerciseHistorySet[]>([]);
  const [coachPrescription, setCoachPrescription] = useState<ExerciseCoachPrescription | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [exerciseHadPr, setExerciseHadPr] = useState(false);
  const [restPaused, setRestPaused] = useState(false);
  const [restTargetSeconds, setRestTargetSeconds] = useState(DEFAULT_REST_SECONDS);
  const [activeChallenge, setActiveChallenge] = useState<WorkoutChallengeTemplate | null>(null);
  const [challengeTrigger, setChallengeTrigger] = useState<WorkoutChallengeTrigger>('between_sets');
  const pendingAdvanceRef = useRef<number | null>(null);
  const offeredExerciseCompleteRef = useRef<number | null>(null);

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
  const remainingSets = Math.max(targetSets - completedSets.length, 0);
  const workoutProgress = useMemo(
    () => computeWorkoutSetProgress(session.exercises, planExercises),
    [session.exercises, planExercises],
  );
  const coachTargetLine = useMemo(() => {
    if (!coachPrescription) return null;
    return formatCoachTargetLine(
      coachPrescription.targets,
      loggingMode,
      (kg) => formatWorkoutWeightForInput(kg, units.preferredWeightUnit),
      units.weightLabel,
      repRange,
    );
  }, [coachPrescription, loggingMode, units.preferredWeightUnit, units.weightLabel, repRange]);
  const supersetGroup = getSupersetGroupForIndex(currentIndex, planExercises);
  const supersetLabel = getSupersetLabel(supersetGroup, currentIndex);
  const inSuperset = Boolean(supersetGroup && supersetGroup.memberIndices.length >= 2);
  const groupComplete =
    inSuperset && supersetGroup
      ? isSupersetGroupComplete(supersetGroup, sortedExercises, planExercises)
      : allSetsDone;
  const currentSessionSets = useMemo(
    () =>
      completedSets.map((set, index) => ({
        weightKg: set.weight ?? 0,
        reps: set.reps ?? 0,
        setNumber: index + 1,
      })),
    [completedSets],
  );
  const coachPlan = useMemo(
    () =>
      planMeta
        ? {
            plannedSets: planMeta.sets,
            plannedReps: planMeta.repRange,
            plannedRestSeconds: planMeta.restSeconds,
            exerciseName: currentExercise?.exercise?.name,
          }
        : undefined,
    [planMeta, currentExercise?.exercise?.name],
  );

  const handleApplyCoachTarget = useCallback(
    (recommended: { weightKg: number; reps: number; durationSeconds?: number }) => {
      if (loggingMode === 'timed') {
        setDurationSeconds(recommended.durationSeconds ?? durationSeconds);
        setReps(1);
        return;
      }
      if (loggingMode === 'bodyweight') {
        setReps(recommended.reps);
        return;
      }
      if (loggingMode === 'weighted' && recommended.weightKg > 0) {
        setWeightKg(recommended.weightKg);
        setReps(recommended.reps);
      }
    },
    [loggingMode, durationSeconds],
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
    setCoachPrescription(null);

    let cancelled = false;
    void workoutService.getRecentSetsForExercise(user.id, currentExercise.exerciseId, 5, mode).then((result) => {
      if (cancelled || !result.success) return;
      setHistorySets(result.data);

      const last = result.data[0];
      if (mode === 'timed') {
        setReps(1);
        if (last?.durationSeconds) {
          setDurationSeconds(last.durationSeconds);
        }
        return;
      }
      if (mode === 'bodyweight') {
        setReps(last?.reps ?? parseTargetReps(repRange));
        return;
      }
      if (last?.weightKg != null && last.reps != null) {
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
    if (groupComplete && completedSets.length > 0) {
      setShowComplete(true);
      setExerciseHadPr(completedSets.some((set) => set.isPr));
    } else {
      setShowComplete(false);
    }
  }, [groupComplete, completedSets]);

  useEffect(() => {
    if (!showComplete || activeChallenge) return;
    if (offeredExerciseCompleteRef.current === currentIndex) return;

    const template = pickWorkoutChallenge(challengeRecords, 'between_exercises');
    if (!template) return;

    offeredExerciseCompleteRef.current = currentIndex;
    setChallengeTrigger('between_exercises');
    setActiveChallenge(template);
  }, [showComplete, activeChallenge, challengeRecords, currentIndex]);

  const offerBetweenSetsChallenge = useCallback(() => {
    if (activeChallenge || groupComplete) return;
    const template = pickWorkoutChallenge(challengeRecords, 'between_sets');
    if (!template) return;
    setChallengeTrigger('between_sets');
    setActiveChallenge(template);
  }, [activeChallenge, challengeRecords, groupComplete]);

  const handleChallengeSkip = useCallback(() => {
    if (!activeChallenge) return;
    onChallengeRecord({
      challengeId: activeChallenge.id,
      kind: activeChallenge.kind,
      title: activeChallenge.title,
      prompt: activeChallenge.prompt,
      status: 'skipped',
      trigger: challengeTrigger,
      exerciseName: currentExercise?.exercise?.name,
    });
    setActiveChallenge(null);
  }, [activeChallenge, challengeTrigger, currentExercise?.exercise?.name, onChallengeRecord]);

  const handleChallengeComplete = useCallback(
    (loggedValue?: string) => {
      if (!activeChallenge) return;
      onChallengeRecord({
        challengeId: activeChallenge.id,
        kind: activeChallenge.kind,
        title: activeChallenge.title,
        prompt: activeChallenge.prompt,
        status: 'completed',
        trigger: challengeTrigger,
        exerciseName: currentExercise?.exercise?.name,
        loggedValue,
      });
      setActiveChallenge(null);
    },
    [activeChallenge, challengeTrigger, currentExercise?.exercise?.name, onChallengeRecord],
  );

  useEffect(() => {
    if (restSecondsRemaining !== 0 || pendingAdvanceRef.current === null) return;
    setCurrentIndex(pendingAdvanceRef.current);
    pendingAdvanceRef.current = null;
    setShowComplete(false);
  }, [restSecondsRemaining]);

  const exerciseVolume = completedSets.reduce((total, set) => {
    if (!set.weight || !set.reps) return total;
    return total + set.weight * set.reps;
  }, 0);

  async function handleLogSet() {
    if (!currentExercise || isPaused || groupComplete) return;

    setLogging(true);
    const base = {
      workoutExerciseId: currentExercise.id,
      restSeconds: restTargetSeconds,
    };

    const postSetAction = resolvePostSetSupersetAction(
      currentIndex,
      planExercises,
      sortedExercises,
      completedSets.length + 1,
    );

    const logged =
      loggingMode === 'timed'
        ? await logSet({ ...base, durationSeconds, reps: 1, skipRest: postSetAction.skipRest })
        : loggingMode === 'bodyweight'
          ? await logSet({ ...base, reps, skipRest: postSetAction.skipRest })
          : await logSet({ ...base, weight: weightKg, reps, skipRest: postSetAction.skipRest });
    setLogging(false);

    if (logged?.isPr) {
      setExerciseHadPr(true);
    }

    await refreshSession();

    if (postSetAction.immediateAdvanceIndex != null) {
      pendingAdvanceRef.current = null;
      setCurrentIndex(postSetAction.immediateAdvanceIndex);
      setShowComplete(false);
    } else if (postSetAction.afterRestAdvanceIndex != null) {
      pendingAdvanceRef.current = postSetAction.afterRestAdvanceIndex;
    }

    offerBetweenSetsChallenge();
  }

  function handleNextExercise() {
    if (supersetGroup && supersetGroup.memberIndices.length >= 2) {
      const next = nextExerciseIndexAfterGroup(supersetGroup, sortedExercises.length);
      if (next != null) {
        setCurrentIndex(next);
        setShowComplete(false);
        return;
      }
    }
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
              <View style={styles.workoutTimeBlock}>
                <AppText variant="caption" color="textSecondary">
                  Workout Time
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {formatWorkoutClockTime(elapsedSeconds)}
                </AppText>
              </View>
            </View>
            <AppText variant="title">{session.name}</AppText>
            <WorkoutProgressBar percent={workoutProgress.percent} />
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

              {supersetLabel ? (
                <AppText variant="caption" color="accent">
                  Superset {supersetGroup?.id.replace('ss-', '')} · Exercise {supersetLabel}
                </AppText>
              ) : null}

              {!showComplete ? (
                <GuidedWorkoutMetrics
                  currentSet={nextSetNumber}
                  targetSets={targetSets}
                  remainingSets={remainingSets}
                  loggingMode={loggingMode}
                  repRange={repRange}
                  historySets={historySets}
                  targetPerformanceLine={coachTargetLine}
                  formatWeight={(kg) => formatWorkoutWeightForInput(kg, units.preferredWeightUnit)}
                  weightLabel={units.weightLabel}
                  fallbackWeightKg={weightKg > 0 ? weightKg : currentExercise.suggestedWeight}
                />
              ) : null}

              {user && currentExercise.exerciseId && !showComplete ? (
                <ExerciseCoachCard
                  variant="inline"
                  showPerformanceSummary={false}
                  loggingMode={loggingMode}
                  userId={user.id}
                  exerciseId={currentExercise.exerciseId}
                  plan={coachPlan}
                  sessionId={session.id}
                  currentSessionSets={currentSessionSets}
                  setNumber={nextSetNumber}
                  onPrescription={setCoachPrescription}
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
                    label={groupComplete ? 'All sets logged' : `Log Set ${nextSetNumber}`}
                    size="large"
                    loading={logging}
                    disabled={isPaused || groupComplete}
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
            isLastExercise={inSuperset ? nextExerciseIndexAfterGroup(supersetGroup!, sortedExercises.length) === null : isLastExercise}
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
        visible={restActive && !showComplete && !activeChallenge}
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

      <WorkoutChallengeModal
        visible={activeChallenge != null}
        challenge={activeChallenge}
        exerciseName={currentExercise?.exercise?.name}
        trigger={challengeTrigger}
        onSkip={handleChallengeSkip}
        onComplete={handleChallengeComplete}
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
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  workoutTimeBlock: {
    alignItems: 'flex-end',
    gap: 2,
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

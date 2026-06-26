import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { Card } from '@/components/layout/Card';
import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenHeader } from '@/components/layout/TabScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { ExerciseCompleteCard } from '@/components/workout/execution/ExerciseCompleteCard';
import { ExerciseGuideSheet } from '@/components/workout/execution/ExerciseGuideSheet';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { GuidedWorkoutMetrics, WorkoutProgressBar } from '@/components/workout/execution/GuidedWorkoutMetrics';
import { SetLoggingControls } from '@/components/workout/execution/SetLoggingControls';
import { SupersetPrepBanner } from '@/components/workout/execution/SupersetPrepBanner';
import { WorkoutChallengeModal } from '@/components/workout/execution/WorkoutChallengeModal';
import { WorkoutTimerOverlay } from '@/components/workout/execution/WorkoutTimerOverlay';
import { WorkoutUpNextCard } from '@/components/workout/execution/WorkoutUpNextCard';
import { ExerciseCoachCard } from '@/components/workout/ExerciseCoachCard';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { useWatchExecutionRestSync } from '@/hooks/useWatchExecutionRestSync';
import { formatWorkoutClockTime, useWorkoutElapsedSeconds } from '@/hooks/useWorkoutElapsedSeconds';
import { useWorkoutTimerEngine } from '@/hooks/useWorkoutTimerEngine';
import {
    computeWorkoutSetProgress,
    formatCoachTargetLine,
} from '@/lib/activeWorkoutMetrics';
import {
    defaultLoadingMethodForExercise,
    inferLoadingMethodFromHistory,
    loadingMethodOptions,
    loadingMethodToLoggingMode,
} from '@/lib/exerciseLoadingMethod';
import {
    defaultTimedDurationSeconds,
    formatSetLoggedLabel,
    getExerciseLoggingMode,
} from '@/lib/exerciseModality';
import { profileFigureGender } from '@/lib/exerciseMuscleMap';
import {
    executionModeUsesSupersetRotation,
    formatExerciseStationLabel,
    getSupersetGroupForIndex,
    isSupersetGroupComplete,
    nextExerciseIndexAfterGroup,
    resolvePostSetFlowAction,
    resolveSupersetWorkoutPosition,
    shouldShowSupersetPrep,
    targetSetsForIndex,
} from '@/lib/supersetFlow';
import {
    executionModeUsesIntervalTimer,
    executionModeUsesTraditionalRest,
    formatTimerSeconds,
    intervalPhaseLabel,
    resolveTraditionalRestSeconds,
} from '@/lib/timerEngine';
import { TABATA_BETWEEN_EXERCISE_REST_BOUNDS, TABATA_BETWEEN_EXERCISE_REST_DEFAULT, TABATA_INTERVAL_BOUNDS, TABATA_PREP_SECONDS_DEFAULT, clampTabataBetweenExerciseRest, clampTabataIntervalSeconds } from '@/lib/trainingPreferences';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { pickWorkoutChallenge } from '@/lib/workoutChallengeFlow';
import { normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import { parseTargetReps } from '@/lib/workoutPlan';
import { logWorkoutProgressionDecision } from '@/lib/workoutProgressionDebug';
import { resolveBetweenExerciseUpNext, resolveTabataPrepUpNext, resolveWorkoutUpNext } from '@/lib/workoutUpNext';
import { workoutService } from '@/services/workoutService';
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { Exercise, WorkoutSession } from '@/types';
import type { ExerciseCoachPrescription } from '@/types/exerciseCoach';
import type { LoadingMethod } from '@/types/exerciseLoading';
import type {
    WorkoutChallengeRecord,
    WorkoutChallengeTemplate,
    WorkoutChallengeTrigger,
} from '@/types/workoutChallenge';
import type { EditableWorkoutExercise, ExerciseHistorySet } from '@/types/workoutExecution';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';
import { useActiveWorkoutVoiceHandlers } from '@/voice/useActiveWorkoutVoiceHandlers';
import { useVoiceWorkoutActivation } from '@/voice/useVoiceWorkoutActivation';
import { VoiceDebugPanel } from '@/voice/VoiceDebugPanel';
import { VoiceMicButton } from '@/voice/VoiceMicButton';

/** Brief pause on exercise complete before auto-advancing (hands-free flow). */
const AUTO_ADVANCE_EXERCISE_MS = 1800;

type ActiveWorkoutScreenProps = {
  session: WorkoutSession;
  planExercises: EditableWorkoutExercise[];
  executionMode?: WorkoutExecutionMode;
  challengeRecords: WorkoutChallengeRecord[];
  onChallengeRecord: (record: WorkoutChallengeRecord) => void;
  onFinish: () => void;
  onCancel: () => void;
};

export function ActiveWorkoutScreen({
  session,
  planExercises,
  executionMode: executionModeProp = 'traditional',
  challengeRecords,
  onChallengeRecord,
  onFinish,
  onCancel,
}: ActiveWorkoutScreenProps) {
  const executionMode = normalizeExecutionMode(executionModeProp);
  const {
    intervalTimer,
    circuitTimer,
    startIntervalTimer,
    dismissIntervalTimer,
    toggleIntervalTimer,
    resetIntervalTimer,
    updateIntervalConfig,
    skipIntervalPhase,
    skipIntervalRound,
    startCircuitTransition,
    skipCircuitTimer,
    dismissCircuitTimer,
  } = useWorkoutTimerEngine(executionMode);

  const handleIntervalConfigChange = useCallback(
    (patch: Partial<{ workSeconds: number; restSeconds: number; rounds: number }>) => {
      const next = { ...patch };
      if (executionMode === 'tabata') {
        if (next.workSeconds != null) next.workSeconds = clampTabataIntervalSeconds(next.workSeconds);
        if (next.restSeconds != null) next.restSeconds = clampTabataIntervalSeconds(next.restSeconds);
      }
      updateIntervalConfig(next);
    },
    [executionMode, updateIntervalConfig],
  );

  const { user } = useAuth();
  const figureGender = profileFigureGender(user?.sex);
  const units = useUnits();
  const {
    restSecondsRemaining,
    activeRestPeriod,
    pauseSession,
    resumeSession,
    logSet,
    setRestTimer,
    skipRestTimer,
    refreshSession,
    deleteSet,
    addExerciseByName,
    setActiveExerciseIndex,
    activeExerciseIndex,
    lastLoggedSet,
    startRestTimer,
    watchDraftReps,
    setWatchDraftReps,
    watchDraftWeightKg,
    setWatchDraftWeightKg,
    restTimerHaptics,
    setExerciseEffectiveTargetSets,
  } = useWorkoutSession();

  const { suppressNextWatchRestComplete } = useWatchExecutionRestSync({
    userId: user?.id,
    restTimerHaptics,
    traditionalRestSeconds: restSecondsRemaining,
    usesTraditionalRest: executionModeUsesTraditionalRest(executionMode),
    intervalTimer,
    circuitTimer,
  });

  const handleIntervalSkipPhase = useCallback(() => {
    suppressNextWatchRestComplete();
    skipIntervalPhase();
  }, [skipIntervalPhase, suppressNextWatchRestComplete]);

  const handleSkipCircuitTimer = useCallback(() => {
    suppressNextWatchRestComplete();
    skipCircuitTimer();
  }, [skipCircuitTimer, suppressNextWatchRestComplete]);

  const watchDraftRepsRef = useRef<number | null>(null);
  watchDraftRepsRef.current = watchDraftReps;
  const watchDraftWeightKgRef = useRef<number | null>(null);
  watchDraftWeightKgRef.current = watchDraftWeightKg;

  const elapsedSeconds = useWorkoutElapsedSeconds(session.startedAt, session.status);

  useAppResume(() => {
    void refreshSession();
  });

  const sortedExercises = useMemo(
    () => [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder),
    [session.exercises],
  );

  const currentIndex = activeExerciseIndex;
  const setCurrentIndex = setActiveExerciseIndex;

  useEffect(() => {
    if (sortedExercises.length === 0) return;
    if (currentIndex >= sortedExercises.length) {
      setActiveExerciseIndex(sortedExercises.length - 1);
    }
  }, [currentIndex, sortedExercises.length, setActiveExerciseIndex]);

  const [weightKg, setWeightKg] = useState(0);
  const [reps, setReps] = useState(8);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [distanceKm, setDistanceKm] = useState(0);
  const [logging, setLogging] = useState(false);
  const [historySets, setHistorySets] = useState<ExerciseHistorySet[]>([]);
  const [coachPrescription, setCoachPrescription] = useState<ExerciseCoachPrescription | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [exerciseHadPr, setExerciseHadPr] = useState(false);
  const [restTargetSeconds, setRestTargetSeconds] = useState(() =>
    resolveTraditionalRestSeconds(executionMode),
  );
  const [activeChallenge, setActiveChallenge] = useState<WorkoutChallengeTemplate | null>(null);
  const [challengeTrigger, setChallengeTrigger] = useState<WorkoutChallengeTrigger>('between_sets');
  const [challengeTargetExerciseName, setChallengeTargetExerciseName] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<LoadingMethod>('external_load');
  const pendingAdvanceRef = useRef<number | null>(null);
  const applyPendingExerciseIndexAdvance = useCallback(() => {
    const nextIndex = pendingAdvanceRef.current;
    if (nextIndex == null) return false;
    pendingAdvanceRef.current = null;
    setCurrentIndex(nextIndex);
    setShowComplete(false);
    return true;
  }, []);
  const pendingAdvanceAfterChallengeRef = useRef<(() => void) | null>(null);
  const pendingExerciseAdvanceAfterRestRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceExerciseRef = useRef<() => void>(() => {});
  const pendingRoundIncrementRef = useRef(false);
  const offeredExerciseCompleteRef = useRef<number | null>(null);
  const [circuitRound, setCircuitRound] = useState(1);
  const [bonusSetsByExerciseId, setBonusSetsByExerciseId] = useState<Record<string, number>>({});
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [exerciseGuideOpen, setExerciseGuideOpen] = useState(false);
  const [intervalOverlayOpen, setIntervalOverlayOpen] = useState(false);
  const [circuitOverlayOpen, setCircuitOverlayOpen] = useState(false);
  const [tabataBetweenExerciseRestSeconds, setTabataBetweenExerciseRestSeconds] = useState(
    TABATA_BETWEEN_EXERCISE_REST_DEFAULT,
  );
  const [pendingAdvanceIndex, setPendingAdvanceIndex] = useState<number | null>(null);
  const [isTabataPrepActive, setIsTabataPrepActive] = useState(false);
  const dismissedSupersetGroupsRef = useRef<Set<string>>(new Set());
  const [supersetBannerTick, setSupersetBannerTick] = useState(0);
  const tabataBetweenExercisePendingRef = useRef(false);
  const tabataExercisePrepPendingRef = useRef(false);
  const tabataSkipPrepAfterTransitionRef = useRef(false);

  const currentExercise = sortedExercises[currentIndex];
  const planMeta = planExercises[currentIndex] ?? planExercises.find(
    (item) => item.name.toLowerCase() === currentExercise?.exercise?.name?.toLowerCase(),
  );
  const targetSets = planMeta?.sets ?? 3;
  const bonusSets = currentExercise?.id ? (bonusSetsByExerciseId[currentExercise.id] ?? 0) : 0;
  const coachRecommendedSets = coachPrescription?.targets.sets ?? targetSets;
  const coachExtraSets = Math.max(0, coachRecommendedSets - targetSets);
  const effectiveTargetSets = Math.max(targetSets + bonusSets, coachRecommendedSets);
  const repRange = planMeta?.repRange ?? currentExercise?.suggestedReps ?? '8-10';
  const completedSets = currentExercise?.sets ?? [];
  const isPaused = session.status === 'paused';
  const restActive =
    executionModeUsesTraditionalRest(executionMode) &&
    restSecondsRemaining !== null &&
    restSecondsRemaining > 0;
  const allSetsDone = completedSets.length >= effectiveTargetSets;
  const coachSetNotice =
    coachExtraSets > 0
      ? `+${coachExtraSets} set${coachExtraSets > 1 ? 's' : ''} today`
      : null;
  const isLastExercise = currentIndex >= sortedExercises.length - 1;
  const nextExercise = sortedExercises[currentIndex + 1];
  const nextPlanMeta = planExercises[currentIndex + 1];
  const loadingOptions = useMemo(
    () => loadingMethodOptions(currentExercise?.exercise, currentExercise?.exercise?.slug),
    [currentExercise?.exercise, currentExercise?.exercise?.slug],
  );
  const loggingMode = loadingMethodToLoggingMode(loadingMethod);
  const coachLoggingMode =
    loggingMode === 'any' ? undefined : (loggingMode as Exclude<typeof loggingMode, 'any'>);
  const nextSetNumber = completedSets.length + 1;
  const remainingSets = Math.max(effectiveTargetSets - completedSets.length, 0);

  const logSetFromVoice = useCallback(
    async (input: {
      workoutExerciseId: string;
      weightKg?: number;
      reps: number;
      restSeconds: number;
    }) => {
      if (isPaused) return false;

      const exerciseIndex = sortedExercises.findIndex((exercise) => exercise.id === input.workoutExerciseId);
      if (exerciseIndex < 0) return false;

      const completedAfterLog = (sortedExercises[exerciseIndex]?.sets?.length ?? 0) + 1;
      const flowAction = resolvePostSetFlowAction(
        exerciseIndex,
        planExercises,
        sortedExercises,
        executionMode,
        circuitRound,
        completedAfterLog,
      );
      const skipRest =
        !executionModeUsesTraditionalRest(executionMode) || flowAction.skipRest;
      const targetForExercise = targetSetsForIndex(exerciseIndex, planExercises);

      if (
        flowAction.afterRestAdvanceIndex != null &&
        flowAction.immediateAdvanceIndex == null
      ) {
        pendingAdvanceRef.current = flowAction.afterRestAdvanceIndex;
      }

      const logged =
        input.weightKg == null
          ? await logSet({
              workoutExerciseId: input.workoutExerciseId,
              reps: input.reps,
              restSeconds: input.restSeconds,
              skipRest,
            })
          : await logSet({
              workoutExerciseId: input.workoutExerciseId,
              weight: input.weightKg,
              reps: input.reps,
              restSeconds: input.restSeconds,
              skipRest,
            });

      if (!logged) return false;

      await refreshSession();

      if (flowAction.circuitTimer && flowAction.circuitTimer.seconds > 0) {
        pendingAdvanceRef.current = flowAction.circuitTimer.advanceIndex;
        pendingRoundIncrementRef.current = flowAction.circuitTimer.phase === 'round_rest';
        startCircuitTransition(
          flowAction.circuitTimer.phase,
          flowAction.circuitTimer.round,
          undefined,
          flowAction.circuitTimer.seconds,
        );
      } else if (flowAction.immediateAdvanceIndex != null) {
        pendingAdvanceRef.current = null;
        setCurrentIndex(flowAction.immediateAdvanceIndex);
        setShowComplete(false);
      } else if (flowAction.afterRestAdvanceIndex != null) {
        if (skipRest) {
          applyPendingExerciseIndexAdvance();
        }
      } else if (
        completedAfterLog >= targetForExercise &&
        executionModeUsesTraditionalRest(executionMode) &&
        !skipRest
      ) {
        pendingExerciseAdvanceAfterRestRef.current = true;
      }

      return true;
    },
    [
      isPaused,
      sortedExercises,
      planExercises,
      executionMode,
      circuitRound,
      logSet,
      refreshSession,
      startCircuitTransition,
      applyPendingExerciseIndexAdvance,
    ],
  );

  const startRestSeconds = useCallback(
    async (seconds: number) => {
      if (lastLoggedSet?.id) {
        await startRestTimer(lastLoggedSet.id, seconds);
        return;
      }
      setRestTimer(seconds);
    },
    [lastLoggedSet?.id, startRestTimer, setRestTimer],
  );

  const undoLastSetFromVoice = useCallback(async () => {
    const setToRemove =
      lastLoggedSet ??
      [...session.exercises]
        .flatMap((exercise) => exercise.sets)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0] ??
      null;
    if (!setToRemove?.id) return false;
    if (activeRestPeriod) await skipRestTimer();
    const removed = await deleteSet(setToRemove.id);
    if (removed) {
      setShowComplete(false);
      await refreshSession();
    }
    return removed;
  }, [activeRestPeriod, deleteSet, lastLoggedSet, refreshSession, session.exercises, skipRestTimer]);

  const voiceHandlers = useActiveWorkoutVoiceHandlers({
    session,
    sortedExerciseIds: sortedExercises.map((exercise) => exercise.id),
    currentExerciseId: currentExercise?.id,
    currentExerciseName: currentExercise?.exercise?.name,
    completedSetCount: completedSets.length,
    targetSetCount: effectiveTargetSets,
    restTargetSeconds,
    preferredWeightUnit: units.preferredWeightUnit,
    isPaused,
    logSetFromVoice,
    undoLastSet: undoLastSetFromVoice,
    goToExerciseIndex: setCurrentIndex,
    startRestSeconds,
    finishWorkout: onFinish,
  });

  useVoiceWorkoutActivation({
    active: true,
    userId: user?.id,
    sessionId: session.id,
    activeExerciseName: currentExercise?.exercise?.name,
    activeExerciseId: currentExercise?.id,
    setNumber: nextSetNumber,
    lastWeight: completedSets[completedSets.length - 1]?.weight,
    lastReps: completedSets[completedSets.length - 1]?.reps,
    preferredWeightUnit: units.preferredWeightUnit,
    handlers: voiceHandlers,
  });
  const supersetGroup = getSupersetGroupForIndex(currentIndex, planExercises);
  const stationLabel = planMeta
    ? formatExerciseStationLabel(planMeta, currentIndex, planExercises)
    : null;
  const inSuperset = Boolean(supersetGroup && supersetGroup.memberIndices.length >= 2);
  const usesSupersetRotation = executionModeUsesSupersetRotation(executionMode);
  const supersetPrepGroup =
    usesSupersetRotation && !showComplete
      ? shouldShowSupersetPrep(currentIndex, planExercises, sortedExercises)
      : null;
  const showSupersetPrepBanner =
    supersetBannerTick >= 0 &&
    supersetPrepGroup != null &&
    !dismissedSupersetGroupsRef.current.has(supersetPrepGroup.id);

  const workoutPosition = useMemo(() => {
    if (
      executionMode === 'tabata' &&
      circuitTimer &&
      circuitTimer.phase !== 'done' &&
      isTabataPrepActive
    ) {
      return resolveTabataPrepUpNext(
        currentExercise?.exercise?.name ?? 'Exercise',
        targetSets,
      );
    }

    if (
      executionMode === 'tabata' &&
      circuitTimer &&
      circuitTimer.phase !== 'done' &&
      pendingAdvanceIndex != null
    ) {
      const pendingExercise = sortedExercises[pendingAdvanceIndex];
      const pendingMeta =
        planExercises[pendingAdvanceIndex] ??
        planExercises.find(
          (item) =>
            item.name.toLowerCase() === pendingExercise?.exercise?.name?.toLowerCase(),
        );
      return resolveBetweenExerciseUpNext(
        pendingExercise?.exercise?.name ?? 'Next exercise',
        pendingMeta?.sets ?? targetSets,
      );
    }

    return usesSupersetRotation && inSuperset
      ? resolveSupersetWorkoutPosition(
          currentIndex,
          planExercises,
          sortedExercises,
          (index) => {
            const meta = planExercises[index];
            const base = meta?.sets ?? 3;
            if (index === currentIndex) return effectiveTargetSets;
            return base;
          },
          isLastExercise,
        )
      : resolveWorkoutUpNext({
      exerciseName: currentExercise?.exercise?.name ?? 'Exercise',
      targetSets: effectiveTargetSets,
      completedSetsCount: completedSets.length,
      isLastExercise,
      nextExerciseName: nextExercise?.exercise?.name,
      nextExerciseTargetSets: nextPlanMeta?.sets,
      activeSetNumber:
        executionModeUsesIntervalTimer(executionMode) && intervalTimer ? intervalTimer.round : null,
    });
  }, [
    executionMode,
    circuitTimer,
    isTabataPrepActive,
    pendingAdvanceIndex,
    currentExercise?.exercise?.name,
    effectiveTargetSets,
    completedSets.length,
    isLastExercise,
    nextExercise?.exercise?.name,
    nextPlanMeta?.sets,
    intervalTimer?.round,
    sortedExercises,
    planExercises,
    currentIndex,
    usesSupersetRotation,
    inSuperset,
  ]);

  const workoutProgress = useMemo(
    () => computeWorkoutSetProgress(session.exercises, planExercises),
    [session.exercises, planExercises],
  );
  const loggedSetCount = useMemo(
    () => sortedExercises.reduce((total, exercise) => total + exercise.sets.length, 0),
    [sortedExercises],
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
  const groupComplete =
    usesSupersetRotation && inSuperset && supersetGroup
      ? isSupersetGroupComplete(supersetGroup, sortedExercises, planExercises)
      : allSetsDone;
  const currentSessionSets = useMemo(() => {
    if (loggingMode === 'timed') {
      return completedSets.map((set, index) => ({
        durationSeconds: set.durationSeconds ?? 0,
        setNumber: index + 1,
      }));
    }
    if (loggingMode === 'bodyweight') {
      return completedSets.map((set, index) => ({
        reps: set.reps ?? 0,
        setNumber: index + 1,
      }));
    }
    return completedSets.map((set, index) => ({
      weightKg: set.weight ?? 0,
      reps: set.reps ?? 0,
      setNumber: index + 1,
    }));
  }, [completedSets, loggingMode]);
  const coachPlan = useMemo(
    () =>
      planMeta
        ? {
            plannedSets: planMeta.sets,
            plannedReps: planMeta.repRange,
            plannedRestSeconds: planMeta.restSeconds,
            exerciseName: currentExercise?.exercise?.name,
            loggingMode: coachLoggingMode,
          }
        : undefined,
    [planMeta, currentExercise?.exercise?.name, coachLoggingMode],
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
    if (!intervalTimer) setIntervalOverlayOpen(false);
  }, [intervalTimer]);

  useEffect(() => {
    if (!circuitTimer || circuitTimer.phase === 'done') setCircuitOverlayOpen(false);
  }, [circuitTimer]);

  useEffect(() => {
    setIntervalOverlayOpen(false);
    setCircuitOverlayOpen(false);
    setIsTabataPrepActive(false);
    tabataBetweenExercisePendingRef.current = false;
    tabataExercisePrepPendingRef.current = false;
    tabataSkipPrepAfterTransitionRef.current = false;
    setPendingAdvanceIndex(null);

    if (!executionModeUsesIntervalTimer(executionMode)) {
      dismissIntervalTimer();
    }
    if (executionMode !== 'tabata' && executionMode !== 'circuit') {
      dismissCircuitTimer();
    }
  }, [executionMode, dismissIntervalTimer, dismissCircuitTimer]);

  useEffect(() => {
    const nextRest = planMeta?.restSeconds ?? resolveTraditionalRestSeconds(executionMode);
    setRestTargetSeconds(nextRest);
  }, [currentExercise?.id, planMeta?.restSeconds, executionMode]);

  useEffect(() => {
    if (circuitTimer?.phase !== 'done') return;
    if (tabataExercisePrepPendingRef.current || tabataBetweenExercisePendingRef.current) return;
    dismissCircuitTimer();
    if (pendingRoundIncrementRef.current) {
      setCircuitRound((round) => round + 1);
      pendingRoundIncrementRef.current = false;
    }
    if (pendingAdvanceRef.current != null) {
      setCurrentIndex(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
      setPendingAdvanceIndex(null);
      setShowComplete(false);
    }
  }, [circuitTimer?.phase, dismissCircuitTimer]);

  useEffect(() => {
    if (watchDraftReps != null) {
      setReps(watchDraftReps);
      return;
    }
    const pending = watchPhoneBridge.getPendingWatchReps();
    if (pending != null) {
      setReps(pending);
    }
  }, [watchDraftReps]);

  useEffect(() => {
    if (watchDraftWeightKg != null) {
      setWeightKg(watchDraftWeightKg);
      return;
    }
    const pending = watchPhoneBridge.getPendingWatchWeightKg();
    if (pending != null) {
      setWeightKg(pending);
    }
  }, [watchDraftWeightKg]);

  useEffect(() => {
    if (!user || !currentExercise?.exerciseId) return;

    setLoadingMethod(
      defaultLoadingMethodForExercise(currentExercise.exercise, currentExercise.exercise?.slug),
    );

    const mode = getExerciseLoggingMode(
      currentExercise.exercise,
      repRange,
      currentExercise.exercise?.name,
    );
    const historyMode =
      loadingMethodOptions(currentExercise.exercise, currentExercise.exercise?.slug).length > 1
        ? ('any' as const)
        : mode;
    setDurationSeconds(defaultTimedDurationSeconds(repRange));
    setCoachPrescription(null);

    let cancelled = false;
    void workoutService
      .getRecentSetsForExercise(user.id, currentExercise.exerciseId, 5, historyMode)
      .then((result: Awaited<ReturnType<typeof workoutService.getRecentSetsForExercise>>) => {
      if (cancelled || !result.success) return;
      setHistorySets(result.data);

      const last = result.data[0];
      const inferredMethod = inferLoadingMethodFromHistory(
        currentExercise.exercise,
        currentExercise.exercise?.slug,
        last?.weightKg,
        last?.durationSeconds,
      );
      setLoadingMethod(inferredMethod);

      if (mode === 'timed') {
        setReps(1);
        if (last?.durationSeconds) {
          setDurationSeconds(last.durationSeconds);
        }
        return;
      }
      if (mode === 'cardio') {
        setReps(1);
        if (last?.durationSeconds) {
          setDurationSeconds(last.durationSeconds);
        }
        if (last?.distanceMeters) {
          setDistanceKm(last.distanceMeters / 1000);
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

      if (watchDraftRepsRef.current != null) {
        setReps(watchDraftRepsRef.current);
      }
      if (watchDraftWeightKgRef.current != null) {
        setWeightKg(watchDraftWeightKgRef.current);
      }
    });

    setShowComplete(false);
    setExerciseHadPr(false);

    return () => {
      cancelled = true;
    };
  }, [currentExercise?.id, currentExercise?.exerciseId, currentExercise?.exercise, currentExercise?.suggestedWeight, repRange, user]);

  useEffect(() => {
    if (!executionModeUsesIntervalTimer(executionMode) || showComplete) return;
    if (circuitTimer && circuitTimer.phase !== 'done') return;

    if (executionMode === 'tabata') {
      const skipPrep = tabataSkipPrepAfterTransitionRef.current;
      tabataSkipPrepAfterTransitionRef.current = false;
      if (!skipPrep) {
        tabataExercisePrepPendingRef.current = true;
        setIsTabataPrepActive(true);
        startCircuitTransition('transition', 1, {
          restBetweenExercisesSeconds: TABATA_PREP_SECONDS_DEFAULT,
        }, TABATA_PREP_SECONDS_DEFAULT);
        return;
      }
    }

    startIntervalTimer(undefined, executionMode === 'tabata');
    setIntervalOverlayOpen(false);
  }, [currentExercise?.id, executionMode, showComplete, startIntervalTimer, circuitTimer?.phase]);

  useEffect(() => {
    if (executionMode !== 'tabata' || showComplete || isPaused) return;
    if (intervalTimer?.phase !== 'done') return;
    if (completedSets.length < effectiveTargetSets) return;
    setShowComplete(true);
    setExerciseHadPr(completedSets.some((set) => set.isPr));
  }, [
    executionMode,
    showComplete,
    isPaused,
    intervalTimer?.phase,
    completedSets,
    effectiveTargetSets,
  ]);

  const scheduleAutoExerciseAdvance = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = setTimeout(() => {
      autoAdvanceTimeoutRef.current = null;
      advanceExerciseRef.current();
    }, AUTO_ADVANCE_EXERCISE_MS);
  }, []);

  useEffect(() => {
    if (!showComplete || restActive || activeChallenge || isPaused) return;
    scheduleAutoExerciseAdvance();
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [showComplete, restActive, activeChallenge, isPaused, currentIndex, scheduleAutoExerciseAdvance]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!circuitTimer || circuitTimer.phase !== 'done') return;

    if (tabataExercisePrepPendingRef.current) {
      tabataExercisePrepPendingRef.current = false;
      setIsTabataPrepActive(false);
      dismissCircuitTimer();
      startIntervalTimer(undefined, true);
      setIntervalOverlayOpen(false);
      return;
    }

    if (!tabataBetweenExercisePendingRef.current) return;
    tabataBetweenExercisePendingRef.current = false;
    tabataSkipPrepAfterTransitionRef.current = true;
    if (pendingAdvanceRef.current != null) {
      setCurrentIndex(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
    }
    setPendingAdvanceIndex(null);
    dismissCircuitTimer();
    setShowComplete(false);
  }, [circuitTimer, dismissCircuitTimer, startIntervalTimer]);

  useEffect(() => {
    setBonusSetsByExerciseId({});
  }, [session.id]);

  const clearExerciseAdvanceState = useCallback(() => {
    pendingExerciseAdvanceAfterRestRef.current = false;
    pendingAdvanceRef.current = null;
    setPendingAdvanceIndex(null);
    pendingAdvanceAfterChallengeRef.current = null;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setShowComplete(false);
  }, []);

  const goToExercise = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, sortedExercises.length - 1));
      if (clamped === currentIndex) return;
      clearExerciseAdvanceState();
      setCurrentIndex(clamped);
    },
    [clearExerciseAdvanceState, currentIndex, sortedExercises.length],
  );

  useEffect(() => {
    if (!currentExercise?.id) return;
    setExerciseEffectiveTargetSets(currentExercise.id, effectiveTargetSets);
  }, [currentExercise?.id, effectiveTargetSets, setExerciseEffectiveTargetSets]);

  useEffect(() => {
    if (coachExtraSets <= 0 || !currentExercise?.id) return;
    setBonusSetsByExerciseId((current) => {
      const existing = current[currentExercise.id] ?? 0;
      if (existing >= coachExtraSets) return current;
      return { ...current, [currentExercise.id]: coachExtraSets };
    });
    clearExerciseAdvanceState();
  }, [coachExtraSets, clearExerciseAdvanceState, currentExercise?.id]);

  useEffect(() => {
    if (groupComplete && completedSets.length > 0 && allSetsDone) {
      setShowComplete(true);
      setExerciseHadPr(completedSets.some((set) => set.isPr));
    } else {
      setShowComplete(false);
    }
  }, [groupComplete, completedSets, allSetsDone]);

  function handleAddSet() {
    if (!currentExercise?.id) return;
    setBonusSetsByExerciseId((current) => ({
      ...current,
      [currentExercise.id]: (current[currentExercise.id] ?? 0) + 1,
    }));
    clearExerciseAdvanceState();
  }

  async function handleDeleteSet(setId: string) {
    Alert.alert('Delete set', 'Remove this logged set?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(setId);
          await refreshSession();
          setShowComplete(false);
        },
      },
    ]);
  }

  async function handleAddExercise(exercise: Exercise) {
    const workoutExerciseId = await addExerciseByName(exercise.name);
    if (!workoutExerciseId) return;
    await refreshSession();
    const refreshed = await workoutService.getSession(session.id);
    if (refreshed.success) {
      const nextIndex = refreshed.data.exercises.findIndex((item) => item.id === workoutExerciseId);
      if (nextIndex >= 0) {
        setCurrentIndex(nextIndex);
        setShowComplete(false);
      }
    }
  }

  const offerBetweenSetsChallenge = useCallback(() => {
    if (activeChallenge || groupComplete) return;
    const template = pickWorkoutChallenge(challengeRecords, 'between_sets');
    if (!template) return;
    setChallengeTargetExerciseName(currentExercise?.exercise?.name ?? null);
    setChallengeTrigger('between_sets');
    setActiveChallenge(template);
  }, [activeChallenge, challengeRecords, groupComplete, currentExercise?.exercise?.name]);

  const handleChallengeSkip = useCallback(() => {
    if (!activeChallenge) return;
    onChallengeRecord({
      challengeId: activeChallenge.id,
      kind: activeChallenge.kind,
      title: activeChallenge.title,
      prompt: activeChallenge.prompt,
      status: 'skipped',
      trigger: challengeTrigger,
      exerciseName: challengeTargetExerciseName ?? currentExercise?.exercise?.name,
    });
    setActiveChallenge(null);
    setChallengeTargetExerciseName(null);
    const advance = pendingAdvanceAfterChallengeRef.current;
    pendingAdvanceAfterChallengeRef.current = null;
    advance?.();
  }, [activeChallenge, challengeTrigger, challengeTargetExerciseName, currentExercise?.exercise?.name, onChallengeRecord]);

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
        exerciseName: challengeTargetExerciseName ?? currentExercise?.exercise?.name,
        loggedValue,
      });
      setActiveChallenge(null);
      setChallengeTargetExerciseName(null);
      const advance = pendingAdvanceAfterChallengeRef.current;
      pendingAdvanceAfterChallengeRef.current = null;
      advance?.();
    },
    [activeChallenge, challengeTrigger, challengeTargetExerciseName, currentExercise?.exercise?.name, onChallengeRecord],
  );

  useEffect(() => {
    if (restSecondsRemaining !== 0) return;
    applyPendingExerciseIndexAdvance();
  }, [restSecondsRemaining, applyPendingExerciseIndexAdvance]);

  useEffect(() => {
    if (restSecondsRemaining !== 0) return;
    if (!pendingExerciseAdvanceAfterRestRef.current) return;
    pendingExerciseAdvanceAfterRestRef.current = false;
    scheduleAutoExerciseAdvance();
  }, [restSecondsRemaining, scheduleAutoExerciseAdvance]);

  const exerciseVolume = completedSets.reduce((total, set) => {
    if (!set.weight || !set.reps) return total;
    return total + set.weight * set.reps;
  }, 0);

  async function handleLogSet() {
    if (!currentExercise || isPaused) return;

    setLogging(true);
    try {
      const base = {
        workoutExerciseId: currentExercise.id,
        restSeconds: restTargetSeconds,
      };

      const completedAfterLog = completedSets.length + 1;
      const flowAction = resolvePostSetFlowAction(
        currentIndex,
        planExercises,
        sortedExercises,
        executionMode,
        circuitRound,
        completedAfterLog,
      );

      const exerciseAdvance = completedAfterLog >= effectiveTargetSets;
      logWorkoutProgressionDecision({
        exerciseId: currentExercise.exerciseId ?? currentExercise.id,
        exerciseName: currentExercise.exercise?.name ?? 'Exercise',
        programmedSets: targetSets,
        completedSets: completedAfterLog,
        advance: exerciseAdvance,
        advanceTrigger: flowAction.immediateAdvanceIndex != null
          ? `immediate_index_${flowAction.immediateAdvanceIndex}`
          : flowAction.afterRestAdvanceIndex != null
            ? `after_rest_index_${flowAction.afterRestAdvanceIndex}`
            : exerciseAdvance
              ? 'exercise_sets_complete'
              : 'stay_on_exercise',
      });

      const skipRest =
        !executionModeUsesTraditionalRest(executionMode) || flowAction.skipRest;

      const repsToLog = watchPhoneBridge.getPendingWatchReps() ?? watchDraftReps ?? reps;
      const weightToLog = watchPhoneBridge.getPendingWatchWeightKg() ?? watchDraftWeightKg ?? weightKg;

      if (
        flowAction.afterRestAdvanceIndex != null &&
        flowAction.immediateAdvanceIndex == null
      ) {
        pendingAdvanceRef.current = flowAction.afterRestAdvanceIndex;
      }

      const logged =
        loggingMode === 'cardio'
          ? await logSet({
              ...base,
              durationSeconds,
              distanceMeters: Math.round(distanceKm * 1000),
              reps: 1,
              skipRest: true,
            })
          : loggingMode === 'timed'
          ? await logSet({ ...base, durationSeconds, reps: 1, skipRest })
          : loggingMode === 'bodyweight'
            ? await logSet({ ...base, reps: repsToLog, skipRest })
            : await logSet({ ...base, weight: weightToLog, reps: repsToLog, skipRest });

      if (logged?.isPr) {
        setExerciseHadPr(true);
      }

      await refreshSession();

      if (flowAction.circuitTimer && flowAction.circuitTimer.seconds > 0) {
        pendingAdvanceRef.current = flowAction.circuitTimer.advanceIndex;
        pendingRoundIncrementRef.current = flowAction.circuitTimer.phase === 'round_rest';
        startCircuitTransition(
          flowAction.circuitTimer.phase,
          flowAction.circuitTimer.round,
          undefined,
          flowAction.circuitTimer.seconds,
        );
      } else if (flowAction.immediateAdvanceIndex != null) {
        pendingAdvanceRef.current = null;
        setCurrentIndex(flowAction.immediateAdvanceIndex);
        setShowComplete(false);
      } else if (flowAction.afterRestAdvanceIndex != null) {
        if (skipRest) {
          applyPendingExerciseIndexAdvance();
        }
      } else if (
        exerciseAdvance &&
        executionModeUsesTraditionalRest(executionMode) &&
        !skipRest
      ) {
        pendingExerciseAdvanceAfterRestRef.current = true;
      }

      if (completedAfterLog < effectiveTargetSets) {
        offerBetweenSetsChallenge();
      }

      setWatchDraftReps(null);
      watchPhoneBridge.clearPendingWatchReps();
      setWatchDraftWeightKg(null);
      watchPhoneBridge.clearPendingWatchWeightKg();
    } finally {
      setLogging(false);
    }
  }

  const handleLogSetRef = useRef(handleLogSet);
  handleLogSetRef.current = handleLogSet;

  useEffect(() => {
    watchPhoneBridge.setLogSetHandler(async () => {
      await handleLogSetRef.current();
    });
    return () => {
      watchPhoneBridge.setLogSetHandler(null);
    };
  }, []);

  useEffect(() => {
    watchPhoneBridge.setTargetSetsReader(() => effectiveTargetSets);
    return () => watchPhoneBridge.setTargetSetsReader(null);
  }, [effectiveTargetSets]);

  useEffect(() => {
    watchPhoneBridge.setDisplayContext({
      stationLabel: stationLabel ?? undefined,
      statusLine: workoutPosition.currentSetLabel,
      supersetHint: usesSupersetRotation && inSuperset ? workoutPosition.upNextLabel : undefined,
      draftReps: watchDraftReps ?? undefined,
    });
    return () => watchPhoneBridge.setDisplayContext(null);
  }, [
    stationLabel,
    workoutPosition.currentSetLabel,
    workoutPosition.upNextLabel,
    usesSupersetRotation,
    inSuperset,
    watchDraftReps,
  ]);

  function performExerciseAdvanceDirect() {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (usesSupersetRotation && supersetGroup && supersetGroup.memberIndices.length >= 2) {
      const next = nextExerciseIndexAfterGroup(supersetGroup, sortedExercises.length);
      if (next != null) {
        if (executionMode === 'tabata') {
          pendingAdvanceRef.current = next;
          setPendingAdvanceIndex(next);
          tabataBetweenExercisePendingRef.current = true;
          dismissIntervalTimer();
          startCircuitTransition('transition', 1, {
            restBetweenExercisesSeconds: tabataBetweenExerciseRestSeconds,
          });
          return;
        }
        setCurrentIndex(next);
        setShowComplete(false);
        return;
      }
    }
    if (isLastExercise) {
      onFinish();
      return;
    }
    if (executionMode === 'tabata') {
      pendingAdvanceRef.current = currentIndex + 1;
      setPendingAdvanceIndex(currentIndex + 1);
      tabataBetweenExercisePendingRef.current = true;
      dismissIntervalTimer();
      startCircuitTransition('transition', 1, {
        restBetweenExercisesSeconds: tabataBetweenExerciseRestSeconds,
      });
      return;
    }
    setCurrentIndex((index) => index + 1);
    setShowComplete(false);
  }

  advanceExerciseRef.current = performExerciseAdvanceDirect;

  function performExerciseAdvance() {
    performExerciseAdvanceDirect();
  }

  function handleFinishBetweenExerciseRest() {
    tabataBetweenExercisePendingRef.current = false;
    handleSkipCircuitTimer();
  }

  function handleFinishTabataPrep() {
    tabataExercisePrepPendingRef.current = false;
    setIsTabataPrepActive(false);
    handleSkipCircuitTimer();
  }

  function handleFinishCircuitTimer() {
    if (isTabataPrepActive) {
      handleFinishTabataPrep();
      return;
    }
    handleFinishBetweenExerciseRest();
  }

  function handleNextExercise() {
    const nextName = nextExercise?.exercise?.name;
    const template = pickWorkoutChallenge(challengeRecords, 'between_exercises');
    if (template && nextName && !activeChallenge) {
      pendingAdvanceAfterChallengeRef.current = performExerciseAdvance;
      setChallengeTargetExerciseName(nextName);
      setChallengeTrigger('between_exercises');
      setActiveChallenge(template);
      return;
    }
    performExerciseAdvance();
  }

  if (!currentExercise) {
    return (
      <ScreenContainer enableTabSwipe={false}>
        <AppText variant="body" color="textSecondary">
          No exercises in this session.
        </AppText>
        <PrimaryButton label="Finish" onPress={onFinish} />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root} testID="active-workout-screen">
      <ScreenContainer
        enableTabSwipe={false}
        keyboardExtraPadding={40}
        header={
          <View style={styles.stickyWorkoutHeader}>
            <TabScreenHeader
              showBrand={false}
              title={session.name}
              subtitle={`${currentIndex + 1} of ${sortedExercises.length} · ${formatWorkoutClockTime(elapsedSeconds)}${loggedSetCount > 0 ? ' · In progress' : ''}`}
              right={
                isPaused ? (
                  <PrimaryButton label="Resume" onPress={resumeSession} />
                ) : (
                  <PrimaryButton label="Pause" variant="ghost" onPress={pauseSession} />
                )
              }
            />
            <WorkoutProgressBar percent={workoutProgress.percent} />
            <View style={styles.exerciseNavRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous exercise"
                onPress={() => goToExercise(currentIndex - 1)}
                disabled={currentIndex === 0 || isPaused}
                style={styles.exerciseNavButton}>
                <AppText variant="caption" color={currentIndex === 0 || isPaused ? 'textTertiary' : 'accent'}>
                  ← Prev
                </AppText>
              </Pressable>
              <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.exerciseNavTitle}>
                {currentIndex + 1}/{sortedExercises.length}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next exercise"
                onPress={() => goToExercise(currentIndex + 1)}
                disabled={isLastExercise || isPaused}
                style={styles.exerciseNavButton}>
                <AppText variant="caption" color={isLastExercise || isPaused ? 'textTertiary' : 'accent'}>
                  Next →
                </AppText>
              </Pressable>
            </View>
          </View>
        }
        contentContainerStyle={styles.content}>
        <GradientBorderCard innerStyle={styles.heroCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`How to do ${currentExercise.exercise?.name ?? 'exercise'}`}
                onPress={() => setExerciseGuideOpen(true)}
                style={styles.exerciseNamePressable}>
                <AppText variant="headline" style={styles.exerciseName}>
                  {currentExercise.exercise?.name ?? 'Exercise'}
                </AppText>
              </Pressable>

              {!showComplete ? (
                <WorkoutUpNextCard
                  position={workoutPosition}
                  compact
                  supersetActive={usesSupersetRotation && inSuperset}
                />
              ) : null}

              {showSupersetPrepBanner && supersetPrepGroup ? (
                <SupersetPrepBanner
                  group={supersetPrepGroup}
                  planExercises={planExercises}
                  sessionExercises={sortedExercises}
                  onDismiss={() => {
                    dismissedSupersetGroupsRef.current.add(supersetPrepGroup.id);
                    setSupersetBannerTick((tick) => tick + 1);
                  }}
                />
              ) : null}

              {executionMode === 'circuit' ? (
                <AppText variant="caption" color="accent">
                  Round {circuitRound}
                  {stationLabel ? ` · ${stationLabel}` : ''}
                </AppText>
              ) : null}

              {!showComplete ? (
                <ExerciseMusclePanel
                  exerciseName={currentExercise.exercise?.name ?? 'Exercise'}
                  gender={figureGender}
                  variant="compact"
                />
              ) : null}

              {!showComplete ? (
                <GuidedWorkoutMetrics
                  currentSet={nextSetNumber}
                  targetSets={effectiveTargetSets}
                  remainingSets={remainingSets}
                  loggingMode={loggingMode}
                  repRange={repRange}
                  historySets={historySets}
                  targetPerformanceLine={coachTargetLine}
                  formatWeight={(kg) => formatWorkoutWeightForInput(kg, units.preferredWeightUnit)}
                  weightLabel={units.weightLabel}
                  distanceUnit={units.preferredDistanceUnit}
                  fallbackWeightKg={weightKg > 0 ? weightKg : currentExercise.suggestedWeight}
                  compact
                  hideTarget={
                    user != null && currentExercise.exerciseId != null && loggingMode !== 'cardio'
                  }
                />
              ) : null}

              {coachSetNotice ? (
                <AppText variant="footnote" color="success">
                  {coachSetNotice}
                </AppText>
              ) : null}

              {user && currentExercise.exerciseId && loggingMode !== 'cardio' && !showComplete ? (
                <ExerciseCoachCard
                  variant="compact"
                  showPerformanceSummary={false}
                  showReason={false}
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

              {loadingOptions.length > 1 && !showComplete ? (
                <View style={styles.loadingMethodRow}>
                  <View style={styles.loadingMethodChoices}>
                    {loadingOptions.map((option) => (
                      <Pressable
                        key={option.method}
                        onPress={() => setLoadingMethod(option.method)}
                        style={[
                          styles.loadingMethodChip,
                          loadingMethod === option.method && styles.loadingMethodChipActive,
                        ]}>
                        <AppText
                          variant="caption"
                          color={loadingMethod === option.method ? 'accent' : 'textSecondary'}>
                          {option.label}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {circuitTimer &&
              circuitTimer.phase !== 'done' &&
              !showComplete ? (
                <Pressable
                  style={styles.timerChip}
                  onPress={() => setCircuitOverlayOpen((open) => !open)}>
                  <AppText variant="bodyBold" color="accent">
                    {isTabataPrepActive ? 'Ready' : 'Break'}{' '}
                    {formatTimerSeconds(circuitTimer.secondsRemaining)}
                  </AppText>
                </Pressable>
              ) : null}

              {executionModeUsesIntervalTimer(executionMode) && !showComplete ? (
                <Pressable
                  style={styles.timerChip}
                  onPress={() => {
                    if (!intervalTimer) startIntervalTimer(undefined, true);
                    setIntervalOverlayOpen((open) => !open);
                  }}>
                  {intervalTimer ? (
                    <AppText variant="bodyBold" color="accent">
                      {intervalPhaseLabel(intervalTimer.phase)} ·{' '}
                      {formatTimerSeconds(intervalTimer.secondsRemaining)}
                    </AppText>
                  ) : (
                    <AppText variant="bodyBold" color="accent">
                      Start timer
                    </AppText>
                  )}
                </Pressable>
              ) : null}

              {executionModeUsesTraditionalRest(executionMode) ? (
              <View style={styles.restPresetRow}>
                {[60, 90, 120, 150].map((seconds) => (
                  <Pressable key={seconds} onPress={() => setRestTargetSeconds(seconds)}>
                    <AppText variant="caption" color={restTargetSeconds === seconds ? 'accent' : 'textTertiary'}>
                      {seconds}s
                    </AppText>
                  </Pressable>
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
                    distanceKm={distanceKm}
                    onChangeWeight={setWeightKg}
                    onChangeReps={setReps}
                    onChangeDuration={setDurationSeconds}
                    onChangeDistance={setDistanceKm}
                    disabled={isPaused || logging}
                  />
                  <PrimaryButton
                    label={allSetsDone ? 'All sets logged' : `Log Set ${nextSetNumber}`}
                    size="large"
                    loading={logging}
                    disabled={isPaused}
                    onPress={handleLogSet}
                    testID="log-set-button"
                  />
                  <VoiceMicButton disabled={isPaused || logging} />
                  <VoiceDebugPanel />
                  <View style={styles.extraActions}>
                    <PrimaryButton label="+ Set" variant="secondary" onPress={handleAddSet} disabled={isPaused} />
                    <PrimaryButton
                      label="+ Exercise"
                      variant="secondary"
                      onPress={() => setExercisePickerVisible(true)}
                      disabled={isPaused}
                    />
                    {completedSets.length > 0 ? (
                      <PrimaryButton
                        label="Undo"
                        variant="ghost"
                        onPress={() => handleDeleteSet(completedSets[completedSets.length - 1]!.id)}
                        disabled={isPaused}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
        </GradientBorderCard>

        <Card style={styles.setProgress}>
          <View style={styles.setChipRow}>
          {Array.from({ length: Math.max(effectiveTargetSets, completedSets.length) }).map((_, index) => {
            const set = completedSets[index];
            const pending = !set;
            return (
              <View
                key={`set-${index + 1}`}
                style={[styles.setChip, pending && styles.setChipPending]}>
                <AppText variant="caption" color={pending ? 'textTertiary' : 'textPrimary'}>
                  {pending
                    ? `${index + 1}`
                    : formatSetLoggedLabel(
                        loggingMode,
                        set,
                        (kg) => formatWorkoutWeightForInput(kg, units.preferredWeightUnit),
                        units.weightLabel,
                        units.preferredDistanceUnit,
                      )}
                </AppText>
              </View>
            );
          })}
          </View>
        </Card>

        {showComplete ? (
          <ExerciseCompleteCard
            volumeKg={exerciseVolume}
            hasPr={exerciseHadPr}
            onNext={handleNextExercise}
            autoAdvancing={!restActive && !activeChallenge}
            isLastExercise={
              usesSupersetRotation && inSuperset
                ? nextExerciseIndexAfterGroup(supersetGroup!, sortedExercises.length) === null
                : isLastExercise
            }
          />
        ) : null}

        <View style={styles.footerActions}>
          <PrimaryButton label="Finish" variant="secondary" onPress={onFinish} testID="finish-workout-button" />
          <PrimaryButton
            label="Cancel"
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

      <WorkoutTimerOverlay
        visible={
          !showComplete &&
          !activeChallenge &&
          ((intervalTimer != null && intervalOverlayOpen) ||
            (circuitTimer != null && circuitTimer.phase !== 'done' && circuitOverlayOpen))
        }
        position={workoutPosition}
        interval={intervalTimer && !circuitTimer ? intervalTimer : null}
        intervalExerciseName={currentExercise.exercise?.name ?? 'Exercise'}
        intervalNextExerciseName={nextExercise?.exercise?.name}
        onIntervalDismiss={() => setIntervalOverlayOpen(false)}
        onIntervalToggle={toggleIntervalTimer}
        onIntervalSkip={handleIntervalSkipPhase}
        onIntervalSkipRound={skipIntervalRound}
        onIntervalReset={resetIntervalTimer}
        onIntervalConfigChange={handleIntervalConfigChange}
        intervalSecondBounds={
          executionMode === 'tabata'
            ? {
                min: TABATA_INTERVAL_BOUNDS.minSeconds,
                max: TABATA_INTERVAL_BOUNDS.maxSeconds,
                step: TABATA_INTERVAL_BOUNDS.stepSeconds,
              }
            : undefined
        }
        betweenExerciseRestSeconds={
          executionMode === 'tabata' && circuitTimer && circuitTimer.phase !== 'done'
            ? isTabataPrepActive
              ? TABATA_PREP_SECONDS_DEFAULT
              : tabataBetweenExerciseRestSeconds
            : undefined
        }
        circuitTimerMode={isTabataPrepActive ? 'prep' : 'between_exercises'}
        onBetweenExerciseRestChange={(seconds) => {
          const next = clampTabataBetweenExerciseRest(seconds);
          setTabataBetweenExerciseRestSeconds(next);
          startCircuitTransition('transition', 1, { restBetweenExercisesSeconds: next }, next);
        }}
        betweenExerciseRestBounds={
          executionMode === 'tabata'
            ? {
                min: TABATA_BETWEEN_EXERCISE_REST_BOUNDS.minSeconds,
                max: TABATA_BETWEEN_EXERCISE_REST_BOUNDS.maxSeconds,
                step: TABATA_BETWEEN_EXERCISE_REST_BOUNDS.stepSeconds,
              }
            : undefined
        }
        circuit={circuitTimer && circuitTimer.phase !== 'done' ? circuitTimer : null}
        onCircuitSkip={handleFinishCircuitTimer}
        onCircuitDismiss={handleFinishCircuitTimer}
      />

      <WorkoutChallengeModal
        visible={activeChallenge != null}
        challenge={activeChallenge}
        exerciseName={challengeTargetExerciseName ?? currentExercise?.exercise?.name}
        trigger={challengeTrigger}
        onSkip={handleChallengeSkip}
        onComplete={handleChallengeComplete}
      />

      <ExercisePickerModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelect={handleAddExercise}
        title="Add Exercise"
      />

      <ExerciseGuideSheet
        visible={exerciseGuideOpen}
        exercise={currentExercise.exercise}
        exerciseName={currentExercise.exercise?.name}
        onClose={() => setExerciseGuideOpen(false)}
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
    gap: Spacing.lg,
  },
  stickyWorkoutHeader: {
    gap: Spacing.sm,
  },
  heroCard: {
    gap: Spacing.md,
  },
  timerChip: {
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  exerciseNamePressable: {
    gap: Spacing.xs,
  },
  exerciseName: {
    letterSpacing: 0.25,
  },
  nextPreview: {
    gap: Spacing.xs,
  },
  restPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  intervalBanner: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  loadingMethodRow: {
    gap: Spacing.sm,
  },
  loadingMethodChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  loadingMethodChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  loadingMethodChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
  setProgress: {
    paddingVertical: Spacing.sm,
  },
  setChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  setChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
  setChipPending: {
    borderColor: LiftFlowColors.border,
    opacity: 0.6,
  },
  footerActions: {
    gap: Spacing.sm,
  },
  extraActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  exerciseNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  exerciseNavButton: {
    minWidth: 56,
    paddingVertical: Spacing.xs,
  },
  exerciseNavTitle: {
    flex: 1,
    textAlign: 'center',
  },
});

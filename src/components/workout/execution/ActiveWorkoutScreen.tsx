import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExerciseCompleteCard } from '@/components/workout/execution/ExerciseCompleteCard';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { GuidedWorkoutMetrics, WorkoutProgressBar } from '@/components/workout/execution/GuidedWorkoutMetrics';
import { SetLoggingControls } from '@/components/workout/execution/SetLoggingControls';
import { WorkoutChallengeModal } from '@/components/workout/execution/WorkoutChallengeModal';
import { WorkoutTimerOverlay } from '@/components/workout/execution/WorkoutTimerOverlay';
import { WorkoutUpNextCard } from '@/components/workout/execution/WorkoutUpNextCard';
import { ExerciseCoachCard } from '@/components/workout/ExerciseCoachCard';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutClockTime, useWorkoutElapsedSeconds } from '@/hooks/useWorkoutElapsedSeconds';
import { useWorkoutTimerEngine } from '@/hooks/useWorkoutTimerEngine';
import {
    computeWorkoutSetProgress,
    formatCoachTargetLine,
} from '@/lib/activeWorkoutMetrics';
import {
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
    pauseRestTimer,
    resumeRestTimer,
    adjustRestTimer,
    setRestTimer,
    skipRestTimer,
    refreshSession,
    deleteSet,
    addExerciseByName,
    setActiveExerciseIndex,
  } = useWorkoutSession();

  const elapsedSeconds = useWorkoutElapsedSeconds(session.startedAt, session.status);

  useAppResume(() => {
    void refreshSession();
  });

  const sortedExercises = useMemo(
    () => [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder),
    [session.exercises],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    setActiveExerciseIndex(currentIndex);
  }, [currentIndex, setActiveExerciseIndex]);
  const [weightKg, setWeightKg] = useState(0);
  const [reps, setReps] = useState(8);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [distanceKm, setDistanceKm] = useState(0);
  const [logging, setLogging] = useState(false);
  const [historySets, setHistorySets] = useState<ExerciseHistorySet[]>([]);
  const [coachPrescription, setCoachPrescription] = useState<ExerciseCoachPrescription | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [exerciseHadPr, setExerciseHadPr] = useState(false);
  const [restPaused, setRestPaused] = useState(false);
  const [restTargetSeconds, setRestTargetSeconds] = useState(() =>
    resolveTraditionalRestSeconds(executionMode),
  );
  const [activeChallenge, setActiveChallenge] = useState<WorkoutChallengeTemplate | null>(null);
  const [challengeTrigger, setChallengeTrigger] = useState<WorkoutChallengeTrigger>('between_sets');
  const [challengeTargetExerciseName, setChallengeTargetExerciseName] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<LoadingMethod>('external_load');
  const pendingAdvanceRef = useRef<number | null>(null);
  const pendingAdvanceAfterChallengeRef = useRef<(() => void) | null>(null);
  const pendingExerciseAdvanceAfterRestRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceExerciseRef = useRef<() => void>(() => {});
  const pendingRoundIncrementRef = useRef(false);
  const offeredExerciseCompleteRef = useRef<number | null>(null);
  const [circuitRound, setCircuitRound] = useState(1);
  const [bonusSets, setBonusSets] = useState(0);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [intervalOverlayOpen, setIntervalOverlayOpen] = useState(false);
  const [restOverlayOpen, setRestOverlayOpen] = useState(false);
  const [circuitOverlayOpen, setCircuitOverlayOpen] = useState(false);
  const [tabataBetweenExerciseRestSeconds, setTabataBetweenExerciseRestSeconds] = useState(
    TABATA_BETWEEN_EXERCISE_REST_DEFAULT,
  );
  const [pendingAdvanceIndex, setPendingAdvanceIndex] = useState<number | null>(null);
  const [isTabataPrepActive, setIsTabataPrepActive] = useState(false);
  const tabataBetweenExercisePendingRef = useRef(false);
  const tabataExercisePrepPendingRef = useRef(false);
  const tabataSkipPrepAfterTransitionRef = useRef(false);

  const currentExercise = sortedExercises[currentIndex];
  const planMeta = planExercises[currentIndex] ?? planExercises.find(
    (item) => item.name.toLowerCase() === currentExercise?.exercise?.name?.toLowerCase(),
  );
  const targetSets = planMeta?.sets ?? 3;
  const effectiveTargetSets = targetSets + bonusSets;
  const repRange = planMeta?.repRange ?? currentExercise?.suggestedReps ?? '8-10';
  const completedSets = currentExercise?.sets ?? [];
  const isPaused = session.status === 'paused';
  const restActive =
    executionModeUsesTraditionalRest(executionMode) &&
    restSecondsRemaining !== null &&
    restSecondsRemaining > 0;
  const programmedSetsComplete = completedSets.length >= targetSets;
  const allSetsDone = completedSets.length >= effectiveTargetSets;
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
  const nextSetNumber = Math.min(completedSets.length + 1, targetSets);
  const remainingSets = Math.max(targetSets - completedSets.length, 0);

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

    return resolveWorkoutUpNext({
      exerciseName: currentExercise?.exercise?.name ?? 'Exercise',
      targetSets,
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
    targetSets,
    completedSets.length,
    isLastExercise,
    nextExercise?.exercise?.name,
    nextPlanMeta?.sets,
    intervalTimer?.round,
    sortedExercises,
    planExercises,
  ]);

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
  const stationLabel = planMeta
    ? formatExerciseStationLabel(planMeta, currentIndex, planExercises)
    : null;
  const inSuperset = Boolean(supersetGroup && supersetGroup.memberIndices.length >= 2);
  const usesSupersetRotation = executionModeUsesSupersetRotation(executionMode);
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
    if (restSecondsRemaining === 0) {
      setRestPaused(false);
    }
  }, [restSecondsRemaining]);

  useEffect(() => {
    if (!restActive) setRestOverlayOpen(false);
  }, [restActive]);

  useEffect(() => {
    if (!intervalTimer) setIntervalOverlayOpen(false);
  }, [intervalTimer]);

  useEffect(() => {
    if (!circuitTimer || circuitTimer.phase === 'done') setCircuitOverlayOpen(false);
  }, [circuitTimer]);

  useEffect(() => {
    setIntervalOverlayOpen(false);
    setRestOverlayOpen(false);
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
    if (!user || !currentExercise?.exerciseId) return;

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
    if (completedSets.length < targetSets) return;
    setShowComplete(true);
    setExerciseHadPr(completedSets.some((set) => set.isPr));
  }, [
    executionMode,
    showComplete,
    isPaused,
    intervalTimer?.phase,
    completedSets,
    targetSets,
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
    setBonusSets(0);
  }, [currentExercise?.id]);

  useEffect(() => {
    if (groupComplete && completedSets.length > 0 && allSetsDone) {
      setShowComplete(true);
      setExerciseHadPr(completedSets.some((set) => set.isPr));
    } else {
      setShowComplete(false);
    }
  }, [groupComplete, completedSets, allSetsDone]);

  function handleAddSet() {
    setBonusSets((count) => count + 1);
    setShowComplete(false);
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
    if (restSecondsRemaining !== 0 || pendingAdvanceRef.current === null) return;
    setCurrentIndex(pendingAdvanceRef.current);
    pendingAdvanceRef.current = null;
    setShowComplete(false);
  }, [restSecondsRemaining]);

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

      const exerciseAdvance = completedAfterLog >= targetSets;
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
            ? await logSet({ ...base, reps, skipRest })
            : await logSet({ ...base, weight: weightKg, reps, skipRest });

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
        pendingAdvanceRef.current = flowAction.afterRestAdvanceIndex;
      } else if (
        exerciseAdvance &&
        executionModeUsesTraditionalRest(executionMode) &&
        !skipRest
      ) {
        pendingExerciseAdvanceAfterRestRef.current = true;
      }

      if (completedAfterLog < targetSets) {
        offerBetweenSetsChallenge();
      }
    } finally {
      setLogging(false);
    }
  }

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
    skipCircuitTimer();
  }

  function handleFinishTabataPrep() {
    tabataExercisePrepPendingRef.current = false;
    setIsTabataPrepActive(false);
    skipCircuitTimer();
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

  function handlePauseRest() {
    pauseRestTimer();
    setRestPaused(true);
  }

  function handleResumeRest() {
    resumeRestTimer();
    setRestPaused(false);
  }

  async function handleSkipRest() {
    setRestOverlayOpen(false);
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

              {!showComplete ? <WorkoutUpNextCard position={workoutPosition} /> : null}

              {executionMode === 'circuit' ? (
                <AppText variant="caption" color="accent">
                  Circuit · Round {circuitRound}
                  {stationLabel ? ` · ${stationLabel}` : ''}
                </AppText>
              ) : null}
              {stationLabel ? (
                <AppText variant="caption" color="accent">
                  {stationLabel} · {(currentExercise.exercise?.name ?? 'Exercise')}
                </AppText>
              ) : null}

              {!showComplete ? (
                <>
                  <AppText variant="caption" color="textTertiary">
                    Exercise muscles
                  </AppText>
                  <ExerciseMusclePanel
                    exerciseName={currentExercise.exercise?.name ?? 'Exercise'}
                    gender={figureGender}
                    variant="compact"
                  />
                </>
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
                  distanceUnit={units.preferredDistanceUnit}
                  fallbackWeightKg={weightKg > 0 ? weightKg : currentExercise.suggestedWeight}
                />
              ) : null}

              {user && currentExercise.exerciseId && loggingMode !== 'cardio' && !showComplete ? (
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

              {loadingOptions.length > 1 && !showComplete ? (
                <View style={styles.loadingMethodRow}>
                  <AppText variant="caption" color="textTertiary">
                    Loading method
                  </AppText>
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

              {restActive && !showComplete ? (
                <View style={styles.intervalBanner}>
                  <AppText variant="label" color="restTimer">
                    Rest timer
                  </AppText>
                  <AppText variant="bodyBold" color="restTimer">
                    {formatTimerSeconds(restSecondsRemaining ?? restTargetSeconds)}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {workoutPosition.currentSetLabel} · {workoutPosition.upNextLabel}
                  </AppText>
                  <PrimaryButton
                    label={restOverlayOpen ? 'Hide timer' : 'Open timer'}
                    variant="secondary"
                    onPress={() => setRestOverlayOpen((open) => !open)}
                  />
                </View>
              ) : null}

              {circuitTimer &&
              circuitTimer.phase !== 'done' &&
              !showComplete ? (
                <View style={styles.intervalBanner}>
                  <AppText variant="label" color="accent">
                    {isTabataPrepActive ? 'Get ready' : 'Rest between exercises'}
                  </AppText>
                  <AppText variant="bodyBold">
                    {formatTimerSeconds(circuitTimer.secondsRemaining)}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {workoutPosition.currentSetLabel} · {workoutPosition.upNextLabel}
                  </AppText>
                  <PrimaryButton
                    label={circuitOverlayOpen ? 'Hide timer' : 'Open timer'}
                    variant="secondary"
                    onPress={() => setCircuitOverlayOpen((open) => !open)}
                  />
                </View>
              ) : null}

              {executionModeUsesIntervalTimer(executionMode) && !showComplete ? (
                <View style={styles.intervalBanner}>
                  <AppText variant="label" color="accent">
                    {executionMode === 'tabata' ? 'Tabata timer' : 'HIIT timer'}
                  </AppText>
                  {intervalTimer ? (
                    <>
                      <AppText variant="bodyBold">
                        {intervalPhaseLabel(intervalTimer.phase).toUpperCase()} ·{' '}
                        {formatTimerSeconds(intervalTimer.secondsRemaining)}
                      </AppText>
                      <AppText variant="footnote" color="textSecondary">
                        {workoutPosition.currentSetLabel} · {workoutPosition.upNextLabel}
                      </AppText>
                    </>
                  ) : (
                    <AppText variant="footnote" color="textSecondary">
                      {executionMode === 'tabata'
                        ? 'Work & rest 20s default · adjust 10–45s each in timer · 10 rounds'
                        : 'Configurable work, rest, and rounds'}
                    </AppText>
                  )}
                  <PrimaryButton
                    label={intervalOverlayOpen ? 'Hide timer' : intervalTimer ? 'Open timer' : 'Start timer'}
                    variant="secondary"
                    onPress={() => {
                      if (!intervalTimer) startIntervalTimer(undefined, true);
                      setIntervalOverlayOpen((open) => !open);
                    }}
                  />
                </View>
              ) : null}

              {executionModeUsesTraditionalRest(executionMode) ? (
              <View style={styles.restPresetRow}>
                {[60, 90, 120, 150].map((seconds) => (
                  <Pressable key={seconds} onPress={() => setRestTargetSeconds(seconds)}>
                    <AppText variant="caption" color={restTargetSeconds === seconds ? 'accent' : 'textSecondary'}>
                      {seconds}s rest
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
                    label={allSetsDone && programmedSetsComplete ? 'All sets logged' : `Log Set ${nextSetNumber}`}
                    size="large"
                    loading={logging}
                    disabled={isPaused}
                    onPress={handleLogSet}
                  />
                  <View style={styles.extraActions}>
                    <PrimaryButton label="+ Add Set" variant="secondary" onPress={handleAddSet} disabled={isPaused} />
                    <PrimaryButton
                      label="+ Add Exercise"
                      variant="secondary"
                      onPress={() => setExercisePickerVisible(true)}
                      disabled={isPaused}
                    />
                    {completedSets.length > 0 ? (
                      <PrimaryButton
                        label="Delete Last Set"
                        variant="ghost"
                        onPress={() => handleDeleteSet(completedSets[completedSets.length - 1]!.id)}
                        disabled={isPaused}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        <Card style={styles.setProgress}>
          {Array.from({ length: Math.max(effectiveTargetSets, completedSets.length) }).map((_, index) => {
            const set = completedSets[index];
            const pending = !set;
            return (
              <Pressable
                key={`set-${index + 1}`}
                style={styles.setRow}
                onLongPress={set ? () => handleDeleteSet(set.id) : undefined}>
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
                      units.preferredDistanceUnit,
                    )}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
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

      <WorkoutTimerOverlay
        visible={
          !showComplete &&
          !activeChallenge &&
          ((restActive && restOverlayOpen) ||
            (intervalTimer != null && intervalOverlayOpen) ||
            (circuitTimer != null && circuitTimer.phase !== 'done' && circuitOverlayOpen))
        }
        position={workoutPosition}
        traditional={restActive && !intervalTimer && !circuitTimer ? {
                secondsRemaining: restSecondsRemaining,
                recommendedSeconds: activeRestPeriod?.recommendedSeconds ?? restTargetSeconds,
                isPaused: restPaused,
                onPause: handlePauseRest,
                onResume: handleResumeRest,
                onSkip: handleSkipRest,
                onAdjust: adjustRestTimer,
                onSetRest: setRestTimer,
                nextExerciseName: nextExercise?.exercise?.name,
                nextExerciseDetail:
                  nextPlanMeta
                    ? `${nextPlanMeta.sets} sets · ${nextPlanMeta.repRange ?? '8-10'} reps`
                    : nextExercise?.suggestedReps
                      ? `${nextExercise.suggestedReps} reps`
                      : null,
              }
            : undefined}
        interval={intervalTimer && !circuitTimer ? intervalTimer : null}
        intervalExerciseName={currentExercise.exercise?.name ?? 'Exercise'}
        intervalNextExerciseName={nextExercise?.exercise?.name}
        onIntervalDismiss={() => setIntervalOverlayOpen(false)}
        onIntervalToggle={toggleIntervalTimer}
        onIntervalSkip={skipIntervalPhase}
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
    backgroundColor: 'rgba(31, 107, 255, 0.12)',
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
  extraActions: {
    gap: Spacing.sm,
  },
});

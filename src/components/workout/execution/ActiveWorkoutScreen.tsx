import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
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
import {
    VoiceSetLogger,
    type VoiceSetLogPayload,
    type VoiceSetLogResult,
} from '@/components/workout/VoiceSetLogger';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutClockTime, useWorkoutElapsedSeconds } from '@/hooks/useWorkoutElapsedSeconds';
import { useWorkoutTimerEngine } from '@/hooks/useWorkoutTimerEngine';
import {
    computeWorkoutExerciseProgress,
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
    formatSupersetPartnerNames,
    getSupersetGroupForIndex,
    isSupersetGroupComplete,
    nextExerciseIndexAfterGroup,
    resolvePostSetFlowAction,
    resolveSupersetWorkoutPosition,
    shouldShowSupersetPrep,
} from '@/lib/supersetFlow';
import {
    executionModeUsesIntervalTimer,
    executionModeUsesTraditionalRest,
    formatTimerSeconds,
    intervalPhaseLabel,
    resolveTraditionalRestSeconds,
} from '@/lib/timerEngine';
import { TABATA_BETWEEN_EXERCISE_REST_BOUNDS, TABATA_BETWEEN_EXERCISE_REST_DEFAULT, TABATA_INTERVAL_BOUNDS, TABATA_PREP_SECONDS_DEFAULT, clampTabataBetweenExerciseRest, clampTabataIntervalSeconds, tabataModeSummary } from '@/lib/trainingPreferences';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { matchSpokenExercise } from '@/lib/voice/matchSpokenExercise';
import { pickWorkoutChallenge } from '@/lib/workoutChallengeFlow';
import { normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import { alignPlanExercisesToSession, parseTargetReps } from '@/lib/workoutPlan';
import { logWorkoutProgressionDecision } from '@/lib/workoutProgressionDebug';
import { resolveBetweenExerciseUpNext, resolveTabataPrepUpNext, resolveWorkoutUpNext } from '@/lib/workoutUpNext';
import { workoutService } from '@/services/workoutService';
import { watchPhoneBridge, type WatchDisplayContext } from '@/state/WatchPhoneBridge';
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
  finishing?: boolean;
};

type LogSetResult = { ok: true } | { ok: false; error: string };

export function ActiveWorkoutScreen({
  session,
  planExercises: planExercisesProp,
  executionMode: executionModeProp = 'traditional',
  challengeRecords,
  onChallengeRecord,
  onFinish,
  onCancel,
  finishing = false,
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
    setTimersPaused,
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
    replaceExerciseByName,
    setActiveExerciseIndex,
    watchDraftReps,
    setWatchDraftReps,
    watchDraftWeightKg,
    setWatchDraftWeightKg,
  } = useWorkoutSession();

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

  /**
   * Every index below (superset groups, circuit stations, set targets) is a session index, so the
   * plan has to be re-ordered to match the session exactly — one entry per session exercise.
   */
  const planExercises = useMemo(
    () => alignPlanExercisesToSession(planExercisesProp, sortedExercises),
    [planExercisesProp, sortedExercises],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  /**
   * Superset partners log back-to-back with no rest. `setCurrentIndex` only lands on the next
   * render, so a second Log Set tap (or watch tap) that fires after `loggingInFlightRef` clears
   * but before that render would still close over the first exercise and write both sets there.
   * Keep the index in a ref and advance it synchronously when the post-set flow says to move.
   */
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
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
  const loggingInFlightRef = useRef(false);
  const advanceExerciseRef = useRef<() => void>(() => {});
  const pendingRoundIncrementRef = useRef(false);
  const offeredExerciseCompleteRef = useRef<number | null>(null);
  const [circuitRound, setCircuitRound] = useState(1);
  const [bonusSets, setBonusSets] = useState(0);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [exercisePickerMode, setExercisePickerMode] = useState<'add' | 'swap'>('add');
  const [exerciseGuideOpen, setExerciseGuideOpen] = useState(false);
  const [intervalOverlayOpen, setIntervalOverlayOpen] = useState(false);
  const [restOverlayOpen, setRestOverlayOpen] = useState(false);
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
  const tabataPrepDoneForExerciseRef = useRef<string | null>(null);
  const intervalStartedForExerciseRef = useRef<string | null>(null);

  const currentExercise = sortedExercises[currentIndex];
  const planMeta = planExercises[currentIndex];
  const targetSets = planMeta?.sets ?? 3;
  const coachRecommendedSets = coachPrescription?.targets.sets ?? targetSets;
  const coachExtraSets = Math.max(0, coachRecommendedSets - targetSets);
  const effectiveTargetSets = Math.max(targetSets + bonusSets, coachRecommendedSets);
  const repRange = planMeta?.repRange ?? currentExercise?.suggestedReps ?? '8-10';
  const completedSets = currentExercise?.sets ?? [];
  const completedSetsCountRef = useRef(0);
  completedSetsCountRef.current = completedSets.length;
  const isPaused = session.status === 'paused';
  const restActive =
    executionModeUsesTraditionalRest(executionMode) &&
    restSecondsRemaining !== null &&
    restSecondsRemaining > 0;
  const transitionActive = circuitTimer != null && circuitTimer.phase !== 'done';
  const allSetsDone = completedSets.length >= effectiveTargetSets;
  const coachSetNotice =
    coachExtraSets > 0
      ? `Coach added ${coachExtraSets} set${coachExtraSets > 1 ? 's' : ''} — ${effectiveTargetSets} sets total today.`
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
  const supersetPartners = useMemo(
    () =>
      usesSupersetRotation && inSuperset && supersetGroup
        ? formatSupersetPartnerNames(supersetGroup, planExercises, sortedExercises)
        : null,
    [usesSupersetRotation, inSuperset, supersetGroup, planExercises, sortedExercises],
  );
  const showSupersetPrepBanner =
    supersetBannerTick >= 0 &&
    supersetPrepGroup != null &&
    !dismissedSupersetGroupsRef.current.has(supersetPrepGroup.id);
  const isFinalExercise =
    usesSupersetRotation && inSuperset && supersetGroup
      ? nextExerciseIndexAfterGroup(supersetGroup, sortedExercises.length) === null
      : isLastExercise;

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

  const workoutSetProgress = useMemo(
    () => computeWorkoutSetProgress(session.exercises, planExercises),
    [session.exercises, planExercises],
  );
  const workoutProgress = useMemo(
    () => computeWorkoutExerciseProgress(currentIndex, sortedExercises.length),
    [currentIndex, sortedExercises.length],
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
    if (restSecondsRemaining === 0) {
      setRestPaused(false);
    }
  }, [restSecondsRemaining]);

  // The rest timer is the only thing that matters between sets, so it presents itself rather than
  // making the lifter find "Open timer" with a bar still in their hands. Keyed on the transition,
  // so dismissing it mid-rest does not immediately reopen it.
  useEffect(() => {
    setRestOverlayOpen(restActive);
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
    tabataPrepDoneForExerciseRef.current = null;
    intervalStartedForExerciseRef.current = null;
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
    // Clear exercise-specific UI state immediately so the next card never renders stale history or
    // carry-over defaults from the previous exercise while async history loads.
    setHistorySets([]);
    setCoachPrescription(null);
    setExerciseHadPr(false);
    setShowComplete(false);
    setDistanceKm(0);
    setWeightKg(0);
    setReps(parseTargetReps(planExercises[currentIndex]?.repRange ?? currentExercise?.suggestedReps));
    setDurationSeconds(defaultTimedDurationSeconds(planExercises[currentIndex]?.repRange ?? currentExercise?.suggestedReps));
  }, [currentExercise?.id]);

  useEffect(() => {
    if (circuitTimer?.phase !== 'done') return;
    if (tabataExercisePrepPendingRef.current || tabataBetweenExercisePendingRef.current) return;
    dismissCircuitTimer();
    if (pendingRoundIncrementRef.current) {
      setCircuitRound((round) => round + 1);
      pendingRoundIncrementRef.current = false;
    }
    if (pendingAdvanceRef.current != null) {
      currentIndexRef.current = pendingAdvanceRef.current;
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

    return () => {
      cancelled = true;
    };
  }, [currentExercise?.id, currentExercise?.exerciseId, currentExercise?.exercise, currentExercise?.suggestedWeight, repRange, user]);

  /**
   * Prep countdown and interval start are one decision keyed on the exercise, so re-running this
   * effect (which the circuit timer's own lifecycle forces) can never restart either of them.
   */
  useEffect(() => {
    if (!executionModeUsesIntervalTimer(executionMode) || showComplete) return;
    if (circuitTimer) return;

    const exerciseKey = currentExercise?.id ?? null;
    if (intervalStartedForExerciseRef.current === exerciseKey) return;

    if (executionMode === 'tabata' && tabataPrepDoneForExerciseRef.current !== exerciseKey) {
      tabataExercisePrepPendingRef.current = true;
      setIsTabataPrepActive(true);
      startCircuitTransition('transition', 1, {
        restBetweenExercisesSeconds: TABATA_PREP_SECONDS_DEFAULT,
      }, TABATA_PREP_SECONDS_DEFAULT);
      return;
    }

    intervalStartedForExerciseRef.current = exerciseKey;
    startIntervalTimer(undefined, executionMode === 'tabata');
    setIntervalOverlayOpen(false);
  }, [currentExercise?.id, executionMode, showComplete, startIntervalTimer, startCircuitTransition, circuitTimer]);

  // For interval modes the protocol's rounds decide when the exercise is done, not the set count.
  useEffect(() => {
    if (!executionModeUsesIntervalTimer(executionMode) || showComplete || isPaused) return;
    if (intervalTimer?.phase !== 'done') return;
    setShowComplete(true);
    setExerciseHadPr(completedSets.some((set) => set.isPr));
  }, [executionMode, showComplete, isPaused, intervalTimer?.phase, completedSets]);

  useEffect(() => {
    setTimersPaused(isPaused);
  }, [isPaused, setTimersPaused]);

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
      tabataPrepDoneForExerciseRef.current = currentExercise?.id ?? null;
      setIsTabataPrepActive(false);
      dismissCircuitTimer();
      return;
    }

    if (!tabataBetweenExercisePendingRef.current) return;
    tabataBetweenExercisePendingRef.current = false;
    if (pendingAdvanceRef.current != null) {
      // The between-exercise rest already served as the prep countdown for the next exercise.
      tabataPrepDoneForExerciseRef.current = sortedExercises[pendingAdvanceRef.current]?.id ?? null;
      currentIndexRef.current = pendingAdvanceRef.current;
      setCurrentIndex(pendingAdvanceRef.current);
      pendingAdvanceRef.current = null;
    }
    setPendingAdvanceIndex(null);
    dismissCircuitTimer();
    setShowComplete(false);
  }, [circuitTimer, currentExercise?.id, dismissCircuitTimer, sortedExercises]);

  useEffect(() => {
    setBonusSets(0);
  }, [currentExercise?.id]);

  useEffect(() => {
    if (coachExtraSets <= 0) return;
    // A coach prescription that arrives after the planned sets are logged must not reopen the
    // exercise, which left the screen asking for a set the user had already finished.
    if (completedSetsCountRef.current >= targetSets) return;
    setBonusSets((current) => (current >= coachExtraSets ? current : coachExtraSets));
    setShowComplete(false);
    pendingExerciseAdvanceAfterRestRef.current = false;
    pendingAdvanceRef.current = null;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, [coachExtraSets, currentExercise?.id, targetSets]);

  useEffect(() => {
    // Interval modes own their own completion signal; a set count must not override it.
    if (executionModeUsesIntervalTimer(executionMode)) return;
    if (groupComplete && completedSets.length > 0 && allSetsDone) {
      setShowComplete(true);
      setExerciseHadPr(completedSets.some((set) => set.isPr));
    } else {
      setShowComplete(false);
    }
  }, [groupComplete, completedSets, allSetsDone, executionMode]);

  function handleAddSet() {
    setBonusSets((count) => count + 1);
    setShowComplete(false);
  }

  function clearPendingExerciseAdvance() {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    pendingAdvanceRef.current = null;
    pendingExerciseAdvanceAfterRestRef.current = false;
    pendingAdvanceAfterChallengeRef.current = null;
  }

  async function handleDeleteSet(setId: string) {
    const setIndex = completedSets.findIndex((set) => set.id === setId) + 1;
    const exerciseName = currentExercise?.exercise?.name ?? 'this exercise';
    Alert.alert('Undo last logged set', `Remove set ${setIndex} from ${exerciseName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo set',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(setId);
          await refreshSession();
          setShowComplete(false);
        },
      },
    ]);
  }

  function handlePreviousExercise() {
    if (currentIndex <= 0 || logging || intervalTimer != null || transitionActive) return;
    clearPendingExerciseAdvance();
    setShowComplete(false);
    setCurrentIndex((index) => {
      const next = Math.max(0, index - 1);
      currentIndexRef.current = next;
      return next;
    });
  }

  /** Jumps to a workout exercise by id, using session order so the index matches what is rendered. */
  async function focusWorkoutExercise(workoutExerciseId: string) {
    const refreshed = await workoutService.getSession(session.id);
    if (!refreshed.success) return;
    const nextIndex = [...refreshed.data.exercises]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .findIndex((item) => item.id === workoutExerciseId);
    if (nextIndex < 0) return;
    clearPendingExerciseAdvance();
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setShowComplete(false);
  }

  async function handleAddExercise(exercise: Exercise) {
    // The new exercise slots in directly after the current one rather than at the end of the
    // workout, and the user is only moved there once the exercise they are on is finished.
    const wasMidExercise = !allSetsDone;
    const workoutExerciseId = await addExerciseByName(exercise.name, {
      afterWorkoutExerciseId: currentExercise?.id,
    });
    if (!workoutExerciseId || wasMidExercise) return;
    await focusWorkoutExercise(workoutExerciseId);
  }

  async function handleSwapExercise(exercise: Exercise) {
    if (!currentExercise) return;
    const workoutExerciseId = await replaceExerciseByName(currentExercise.id, exercise.name);
    if (!workoutExerciseId) {
      Alert.alert('Could not swap exercise', 'Please try again.');
      return;
    }
    await focusWorkoutExercise(workoutExerciseId);
  }

  const offerBetweenSetsChallenge = useCallback(() => {
    if (
      activeChallenge ||
      groupComplete ||
      restActive ||
      usesSupersetRotation ||
      executionModeUsesIntervalTimer(executionMode)
    ) {
      return;
    }
    const template = pickWorkoutChallenge(challengeRecords, 'between_sets');
    if (!template) return;
    setChallengeTargetExerciseName(currentExercise?.exercise?.name ?? null);
    setChallengeTrigger('between_sets');
    setActiveChallenge(template);
  }, [
    activeChallenge,
    challengeRecords,
    currentExercise?.exercise?.name,
    executionMode,
    groupComplete,
    restActive,
    usesSupersetRotation,
  ]);

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
    currentIndexRef.current = pendingAdvanceRef.current;
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

  const clearWatchDrafts = useCallback(() => {
    setWatchDraftReps(null);
    watchPhoneBridge.clearPendingWatchReps();
    setWatchDraftWeightKg(null);
    watchPhoneBridge.clearPendingWatchWeightKg();
  }, [setWatchDraftReps, setWatchDraftWeightKg]);

  const commitSetLog = useCallback(async (overrides?: {
    weightKg?: number;
    reps?: number;
    durationSeconds?: number;
    distanceKm?: number;
  }): Promise<LogSetResult> => {
    // Read the live index from the ref so a second tap during a no-rest superset advance
    // cannot reuse the previous exercise's workout_exercise id from a stale render closure.
    const logIndex = currentIndexRef.current;
    const logExercise = sortedExercises[logIndex];
    if (!logExercise) {
      return { ok: false, error: 'No exercise selected.' };
    }
    if (isPaused) {
      return { ok: false, error: 'Resume your workout before logging a set.' };
    }
    if (logging || loggingInFlightRef.current) {
      return { ok: false, error: 'A set is already being logged.' };
    }
    const logCompletedSets = logExercise.sets ?? [];
    const logPlanMeta = planExercises[logIndex];
    const logTargetSets = Math.max(
      (logPlanMeta?.sets ?? 3) + bonusSets,
      coachPrescription?.targets.sets ?? logPlanMeta?.sets ?? 3,
    );
    if (logCompletedSets.length >= logTargetSets) {
      return { ok: false, error: 'All planned sets are already logged.' };
    }
    if (restActive || intervalTimer != null || transitionActive) {
      return { ok: false, error: 'Finish the current rest or transition before logging the next set.' };
    }

    const resolvedWeightKg = overrides?.weightKg ?? weightKg;
    const resolvedReps = overrides?.reps ?? reps;
    const resolvedDurationSeconds = overrides?.durationSeconds ?? durationSeconds;
    const resolvedDistanceKm = overrides?.distanceKm ?? distanceKm;

    loggingInFlightRef.current = true;
    setLogging(true);
    try {
      const base = {
        workoutExerciseId: logExercise.id,
        restSeconds: restTargetSeconds,
      };

      const completedAfterLog = logCompletedSets.length + 1;
      const flowAction = resolvePostSetFlowAction(
        logIndex,
        planExercises,
        sortedExercises,
        executionMode,
        circuitRound,
        completedAfterLog,
      );

      const exerciseAdvance = completedAfterLog >= logTargetSets;
      logWorkoutProgressionDecision({
        exerciseId: logExercise.exerciseId ?? logExercise.id,
        exerciseName: logExercise.exercise?.name ?? 'Exercise',
        programmedSets: logPlanMeta?.sets ?? 3,
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
              durationSeconds: resolvedDurationSeconds,
              distanceMeters: Math.round(resolvedDistanceKm * 1000),
              reps: 1,
              skipRest: true,
            })
          : loggingMode === 'timed'
          ? await logSet({ ...base, durationSeconds: resolvedDurationSeconds, reps: 1, skipRest })
          : loggingMode === 'bodyweight'
            ? await logSet({ ...base, reps: resolvedReps, skipRest })
            : await logSet({ ...base, weight: resolvedWeightKg, reps: resolvedReps, skipRest });

      if (!logged) {
        AccessibilityInfo.announceForAccessibility('Could not log set. Try again.');
        return { ok: false, error: 'Could not save that set.' };
      }

      if (logged.isPr) {
        setExerciseHadPr(true);
      }

      // The set list updates silently, so a screen-reader user gets no confirmation that the tap
      // registered — and the rest timer that follows is equally unannounced.
      AccessibilityInfo.announceForAccessibility(
        `Set ${completedAfterLog} of ${logTargetSets} logged${logged.isPr ? '. New personal record' : ''}`,
      );

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
        // Advance the ref before unlocking so a second Log Set cannot hit the previous exercise.
        currentIndexRef.current = flowAction.immediateAdvanceIndex;
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

      if (completedAfterLog < logTargetSets && !skipRest) {
        offerBetweenSetsChallenge();
      }

      clearWatchDrafts();
      return { ok: true };
    } finally {
      loggingInFlightRef.current = false;
      setLogging(false);
    }
  }, [
    bonusSets,
    circuitRound,
    clearWatchDrafts,
    coachPrescription?.targets.sets,
    distanceKm,
    durationSeconds,
    executionMode,
    intervalTimer,
    isPaused,
    logSet,
    logging,
    loggingMode,
    offerBetweenSetsChallenge,
    planExercises,
    reps,
    restActive,
    restTargetSeconds,
    sortedExercises,
    startCircuitTransition,
    transitionActive,
    weightKg,
  ]);

  const handleLogSet = useCallback(() => commitSetLog(), [commitSetLog]);

  const handleVoiceLogSet = useCallback(
    async (payload: VoiceSetLogPayload): Promise<VoiceSetLogResult> => {
      const activeExercise = sortedExercises[currentIndexRef.current];
      const activeName = activeExercise?.exercise?.name;
      if (!activeName) {
        return { ok: false, reason: 'No exercise is selected.' };
      }

      if (payload.exerciseName?.trim()) {
        const match = matchSpokenExercise(payload.exerciseName, activeName);
        if (match.kind === 'different') {
          // Previously a silent `false`, which surfaced as "Could not save that set" with no hint
          // that the name was the problem — sighted users got no reason at all.
          AccessibilityInfo.announceForAccessibility(match.reason);
          return { ok: false, reason: match.reason };
        }
      }

      if (payload.weight != null) {
        setWeightKg(payload.weight);
      }
      if (payload.reps != null) {
        setReps(payload.reps);
      }

      const result = await commitSetLog({
        weightKg: payload.weight,
        reps: payload.reps,
      });
      // `commitSetLog` already explains rest timers, paused sessions and completed set targets.
      // Dropping that to a boolean is what made every voice failure read the same.
      if (!result.ok) return { ok: false, reason: result.error };
      return { ok: true, loggedAs: activeName };
    },
    [commitSetLog, sortedExercises],
  );

  const handleLogSetRef = useRef(handleLogSet);
  handleLogSetRef.current = handleLogSet;

  useEffect(() => {
    watchPhoneBridge.setLogSetHandler(async () => {
      return handleLogSetRef.current();
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
    const context: WatchDisplayContext = {
      stationLabel: stationLabel ?? undefined,
      statusLine: workoutPosition.currentSetLabel,
      draftReps: watchDraftReps ?? undefined,
    };
    if (usesSupersetRotation && inSuperset) {
      context.supersetHint = supersetPartners ?? workoutPosition.upNextLabel;
    }
    watchPhoneBridge.setDisplayContext(context);
    return () => watchPhoneBridge.setDisplayContext(null);
  }, [
    stationLabel,
    supersetPartners,
    workoutPosition.currentSetLabel,
    workoutPosition.upNextLabel,
    usesSupersetRotation,
    inSuperset,
    watchDraftReps,
  ]);

  function performExerciseAdvanceDirect(options?: { auto?: boolean }) {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (usesSupersetRotation && supersetGroup && supersetGroup.memberIndices.length >= 2) {
      const incompletePartner = [...supersetGroup.memberIndices]
        .sort((a, b) => a - b)
        .find((index) => {
          if (index === currentIndexRef.current) return false;
          const target = planExercises[index]?.sets ?? 3;
          return (sortedExercises[index]?.sets?.length ?? 0) < target;
        });
      if (incompletePartner != null) {
        currentIndexRef.current = incompletePartner;
        setCurrentIndex(incompletePartner);
        setShowComplete(false);
        return;
      }
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
        currentIndexRef.current = next;
        setCurrentIndex(next);
        setShowComplete(false);
        return;
      }
    }
    if (isLastExercise) {
      // Ending a session is destructive and unrecoverable, so the last exercise waits for an
      // explicit press instead of letting the auto-advance timer finish the workout unprompted.
      if (!options?.auto) onFinish();
      return;
    }
    if (executionMode === 'tabata') {
      pendingAdvanceRef.current = currentIndexRef.current + 1;
      setPendingAdvanceIndex(currentIndexRef.current + 1);
      tabataBetweenExercisePendingRef.current = true;
      dismissIntervalTimer();
      startCircuitTransition('transition', 1, {
        restBetweenExercisesSeconds: tabataBetweenExerciseRestSeconds,
      });
      return;
    }
    const nextIndex = currentIndexRef.current + 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setShowComplete(false);
  }

  advanceExerciseRef.current = () => performExerciseAdvanceDirect({ auto: true });

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

  // Rest deliberately does not block this. Being unable to step back to the exercise you are on is
  // worse than a rest timer that keeps counting while you navigate.
  const canGoToPreviousExercise =
    currentIndex > 0 && !logging && intervalTimer == null && !transitionActive;

  if (!currentExercise) {
    return (
      <ScreenContainer>
        <AppText variant="body" color="textSecondary">
          No exercises in this session.
        </AppText>
        <PrimaryButton label="Finish" loading={finishing} disabled={finishing} onPress={onFinish} />
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
            <AppText variant="caption" color="textSecondary">
              Exercise {workoutProgress.currentExerciseNumber} of {workoutProgress.totalExercises}
              {' · '}
              {workoutSetProgress.completedSets} of {workoutSetProgress.totalSets} sets logged
            </AppText>
          </View>
          <View style={styles.headerActions}>
            {currentIndex > 0 ? (
              <PrimaryButton
                label="Previous"
                variant="ghost"
                onPress={handlePreviousExercise}
                disabled={!canGoToPreviousExercise}
              />
            ) : null}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`How to do ${currentExercise.exercise?.name ?? 'exercise'}`}
                onPress={() => setExerciseGuideOpen(true)}
                style={styles.exerciseNamePressable}>
                <AppText variant="headline" style={styles.exerciseName}>
                  {(currentExercise.exercise?.name ?? 'Exercise').toUpperCase()}
                </AppText>
                <AppText variant="caption" color="accent">
                  Tap for form guide
                </AppText>
              </Pressable>

              {!showComplete ? <WorkoutUpNextCard position={workoutPosition} supersetActive={usesSupersetRotation && inSuperset} /> : null}

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

              {usesSupersetRotation && inSuperset && !showComplete && !showSupersetPrepBanner ? (
                <AppText variant="footnote" color="accent">
                  Superset active · {workoutPosition.upNextLabel}
                </AppText>
              ) : null}

              {usesSupersetRotation && inSuperset && supersetPartners ? (
                <View style={styles.supersetCard}>
                  <AppText variant="caption" color="accent">
                    Superset members
                  </AppText>
                  <AppText variant="bodyBold">{supersetPartners}</AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {workoutPosition.upNextLabel}
                  </AppText>
                </View>
              ) : null}

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
                />
              ) : null}

              {coachSetNotice ? (
                <AppText variant="footnote" color="success">
                  {coachSetNotice}
                </AppText>
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
                        ? `${tabataModeSummary()} · adjust ${TABATA_INTERVAL_BOUNDS.minSeconds}–${TABATA_INTERVAL_BOUNDS.maxSeconds}s each in timer`
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
                  <Pressable
                    key={seconds}
                    accessibilityRole="radio"
                    accessibilityLabel={`${seconds} second rest`}
                    accessibilityState={{ selected: restTargetSeconds === seconds }}
                    hitSlop={12}
                    style={styles.restPresetChip}
                    onPress={() => setRestTargetSeconds(seconds)}>
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
                    disabled={
                      isPaused ||
                      logging ||
                      restActive ||
                      intervalTimer != null ||
                      (circuitTimer != null && circuitTimer.phase !== 'done')
                    }
                  />
                  {allSetsDone ? (
                    // Every set is in but the exercise-complete card is not up, so this is the way
                    // forward instead of a disabled button the user cannot get past.
                    <PrimaryButton
                      label={isFinalExercise ? 'Finish Workout' : 'Next Exercise'}
                      size="large"
                      loading={finishing}
                      disabled={isPaused || logging}
                      onPress={isFinalExercise ? onFinish : handleNextExercise}
                    />
                  ) : (
                    <PrimaryButton
                      label={`Log Set ${nextSetNumber}`}
                      size="large"
                      loading={logging}
                      disabled={
                        isPaused ||
                        logging ||
                        restActive ||
                        intervalTimer != null ||
                        (circuitTimer != null && circuitTimer.phase !== 'done')
                      }
                      onPress={() => {
                        void handleLogSet();
                      }}
                    />
                  )}
                  {user && (loggingMode === 'weighted' || loggingMode === 'bodyweight') ? (
                    <VoiceSetLogger
                      userId={user.id}
                      onLogSet={handleVoiceLogSet}
                      activeExerciseName={currentExercise.exercise?.name}
                      lastWeightKg={completedSets[completedSets.length - 1]?.weight ?? (weightKg > 0 ? weightKg : undefined)}
                      lastReps={completedSets[completedSets.length - 1]?.reps ?? (reps > 0 ? reps : undefined)}
                      disabled={
                        isPaused ||
                        logging ||
                        restActive ||
                        intervalTimer != null ||
                        (circuitTimer != null && circuitTimer.phase !== 'done')
                      }
                    />
                  ) : null}
                  <View style={styles.extraActions}>
                    <PrimaryButton label="+ Add Set" variant="secondary" onPress={handleAddSet} disabled={isPaused} />
                    <PrimaryButton
                      label="+ Add Exercise"
                      variant="secondary"
                      onPress={() => {
                        setExercisePickerMode('add');
                        setExercisePickerVisible(true);
                      }}
                      disabled={isPaused}
                    />
                    <PrimaryButton
                      label="Swap Exercise"
                      variant="secondary"
                      onPress={() => {
                        setExercisePickerMode('swap');
                        setExercisePickerVisible(true);
                      }}
                      disabled={isPaused}
                    />
                    {completedSets.length > 0 ? (
                      <PrimaryButton
                        label="Undo Last Logged Set"
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
            autoAdvancing={!restActive && !activeChallenge && !isFinalExercise}
            isLastExercise={isFinalExercise}
          />
        ) : null}

        <View style={styles.footerActions}>
          <PrimaryButton
            label="Finish Workout"
            variant="secondary"
            loading={finishing}
            disabled={finishing}
            onPress={onFinish}
          />
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
                nextExerciseName: usesSupersetRotation && inSuperset
                  ? workoutPosition.upNextLabel
                  : nextExercise?.exercise?.name,
                nextExerciseDetail:
                  usesSupersetRotation && inSuperset
                    ? 'Superset rotation'
                    : nextPlanMeta
                    ? `${nextPlanMeta.sets} sets · ${nextPlanMeta.repRange ?? '8-10'} reps`
                    : nextExercise?.suggestedReps
                      ? `${nextExercise.suggestedReps} reps`
                      : null,
              }
            : undefined}
        onTraditionalDismiss={() => setRestOverlayOpen(false)}
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
        onCircuitDismiss={() => setCircuitOverlayOpen(false)}
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
        onSelect={exercisePickerMode === 'swap' ? handleSwapExercise : handleAddExercise}
        title={
          exercisePickerMode === 'swap'
            ? `Swap ${currentExercise.exercise?.name ?? 'Exercise'}`
            : 'Add Exercise'
        }
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
    gap: Spacing.sm,
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
  exerciseNamePressable: {
    gap: Spacing.xs,
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
  restPresetChip: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  intervalBanner: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  supersetCard: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
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

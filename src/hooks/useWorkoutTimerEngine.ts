import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { cueIntervalPhase } from '@/lib/intervalTimerFeedback';
import {
    skipIntervalRound as advanceIntervalRound,
    advanceCircuitTimerToNow,
    advanceIntervalPhase,
    advanceIntervalTimerToNow,
    createCircuitTimerState,
    createIntervalTimerState,
    type CircuitPhase,
    type CircuitTimerConfig,
    type CircuitTimerState,
    type IntervalPhase,
    type IntervalTimerConfig,
    type IntervalTimerState,
} from '@/lib/timerEngine';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

const TICK_MS = 100;

function secondsForPhase(state: IntervalTimerState): number {
  if (state.phase === 'work') return state.config.workSeconds;
  if (state.phase === 'rest') return state.config.restSeconds;
  return 0;
}

export function useWorkoutTimerEngine(executionMode: WorkoutExecutionMode) {
  const [intervalTimer, setIntervalTimer] = useState<IntervalTimerState | null>(null);
  const [circuitTimer, setCircuitTimer] = useState<CircuitTimerState | null>(null);
  const lastIntervalPhaseRef = useRef<IntervalPhase | null>(null);
  const intervalDeadlineRef = useRef<number | null>(null);
  const circuitDeadlineRef = useRef<number | null>(null);
  const intervalPausedBySessionRef = useRef(false);
  const circuitPausedBySessionRef = useRef(false);

  const syncIntervalDeadline = useCallback((secondsRemaining: number) => {
    intervalDeadlineRef.current = Date.now() + secondsRemaining * 1000;
  }, []);

  const syncCircuitDeadline = useCallback((secondsRemaining: number) => {
    circuitDeadlineRef.current = Date.now() + secondsRemaining * 1000;
  }, []);

  const readIntervalRemaining = useCallback(() => {
    const endAt = intervalDeadlineRef.current;
    if (endAt == null) return null;
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }, []);

  /** Recompute phase, round and remaining seconds purely from the deadline and the clock. */
  const resyncIntervalToNow = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || !current.running || current.phase === 'done') return current;
      const deadline = intervalDeadlineRef.current;
      if (deadline == null) return current;

      const advanced = advanceIntervalTimerToNow(current, deadline, Date.now());
      intervalDeadlineRef.current = advanced.state.phase === 'done' ? null : advanced.deadlineMs;
      const next = advanced.state;
      if (
        next.phase === current.phase &&
        next.round === current.round &&
        next.secondsRemaining === current.secondsRemaining
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const resyncCircuitToNow = useCallback(() => {
    setCircuitTimer((current) => {
      if (!current || !current.running || current.phase === 'done') return current;
      const deadline = circuitDeadlineRef.current;
      if (deadline == null) return current;

      const next = advanceCircuitTimerToNow(current, deadline, Date.now());
      if (next.phase === 'done') circuitDeadlineRef.current = null;
      if (next.phase === current.phase && next.secondsRemaining === current.secondsRemaining) {
        return current;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!intervalTimer?.running || intervalTimer.phase === 'done') return;
    const handle = setInterval(resyncIntervalToNow, TICK_MS);
    return () => clearInterval(handle);
  }, [intervalTimer?.running, intervalTimer?.phase, resyncIntervalToNow]);

  useEffect(() => {
    if (!circuitTimer?.running || circuitTimer.phase === 'done') return;
    const handle = setInterval(resyncCircuitToNow, TICK_MS);
    return () => clearInterval(handle);
  }, [circuitTimer?.running, circuitTimer?.phase, resyncCircuitToNow]);

  // Intervals stop firing while the app is backgrounded, so catch up on the way back in.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      resyncIntervalToNow();
      resyncCircuitToNow();
    });
    return () => subscription.remove();
  }, [resyncIntervalToNow, resyncCircuitToNow]);

  useEffect(
    () => () => {
      intervalDeadlineRef.current = null;
      circuitDeadlineRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (executionMode === 'hiit' || executionMode === 'tabata') return;
    intervalDeadlineRef.current = null;
    circuitDeadlineRef.current = null;
    setIntervalTimer(null);
    setCircuitTimer(null);
    lastIntervalPhaseRef.current = null;
  }, [executionMode]);

  useEffect(() => {
    if (!intervalTimer) {
      lastIntervalPhaseRef.current = null;
      return;
    }
    if (lastIntervalPhaseRef.current === intervalTimer.phase) return;
    // A phase the user hasn't started yet gets no cue; the first work interval does.
    if (!intervalTimer.running && intervalTimer.phase !== 'done') return;
    cueIntervalPhase(intervalTimer.phase);
    lastIntervalPhaseRef.current = intervalTimer.phase;
  }, [intervalTimer?.phase, intervalTimer]);

  const startIntervalTimer = useCallback(
    (overrides?: Partial<IntervalTimerConfig>, autoStart = false) => {
      if (executionMode !== 'hiit' && executionMode !== 'tabata') return;
      const state = createIntervalTimerState(executionMode, overrides);
      if (autoStart) syncIntervalDeadline(state.secondsRemaining);
      else intervalDeadlineRef.current = null;
      setIntervalTimer({ ...state, running: autoStart });
      lastIntervalPhaseRef.current = null;
    },
    [executionMode, syncIntervalDeadline],
  );

  const dismissIntervalTimer = useCallback(() => {
    intervalDeadlineRef.current = null;
    setIntervalTimer(null);
    lastIntervalPhaseRef.current = null;
  }, []);

  const toggleIntervalTimer = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || current.phase === 'done') {
        if (executionMode !== 'hiit' && executionMode !== 'tabata') return current;
        const next = createIntervalTimerState(executionMode);
        syncIntervalDeadline(next.secondsRemaining);
        lastIntervalPhaseRef.current = null;
        return { ...next, running: true };
      }
      if (current.running) {
        const remaining = readIntervalRemaining() ?? current.secondsRemaining;
        intervalDeadlineRef.current = null;
        return { ...current, running: false, secondsRemaining: remaining };
      }
      syncIntervalDeadline(current.secondsRemaining);
      return { ...current, running: true };
    });
  }, [executionMode, readIntervalRemaining, syncIntervalDeadline]);

  const resetIntervalTimer = useCallback(() => {
    if (executionMode !== 'hiit' && executionMode !== 'tabata') return;
    const state = createIntervalTimerState(executionMode);
    intervalDeadlineRef.current = null;
    setIntervalTimer(state);
    lastIntervalPhaseRef.current = null;
  }, [executionMode]);

  const updateIntervalConfig = useCallback(
    (patch: Partial<IntervalTimerConfig>) => {
      setIntervalTimer((current) => {
        if (!current) return current;
        const config = { ...current.config, ...patch };
        if (current.phase === 'done') return { ...current, config };

        // Retuning the length mid-phase must not restart the phase the user is already inside.
        const elapsed = Math.max(0, secondsForPhase(current) - current.secondsRemaining);
        const nextTotal = current.phase === 'work' ? config.workSeconds : config.restSeconds;
        const secondsRemaining = Math.max(0, nextTotal - elapsed);
        if (current.running) syncIntervalDeadline(secondsRemaining);
        return { ...current, config, secondsRemaining };
      });
    },
    [syncIntervalDeadline],
  );

  /** Skipping keeps the paused/running state the user chose — it is not a resume button. */
  const applyIntervalSkip = useCallback(
    (advance: (state: IntervalTimerState) => IntervalTimerState) => {
      setIntervalTimer((current) => {
        if (!current || current.phase === 'done') return current;
        const transitioned = advance(current);
        if (transitioned.phase === 'done') {
          intervalDeadlineRef.current = null;
          return transitioned;
        }
        const nextSeconds = secondsForPhase(transitioned);
        if (current.running) syncIntervalDeadline(nextSeconds);
        else intervalDeadlineRef.current = null;
        return { ...transitioned, secondsRemaining: nextSeconds, running: current.running };
      });
    },
    [syncIntervalDeadline],
  );

  const skipIntervalPhase = useCallback(() => {
    applyIntervalSkip((current) => advanceIntervalPhase({ ...current, secondsRemaining: 0 }));
  }, [applyIntervalSkip]);

  const skipIntervalRound = useCallback(() => {
    applyIntervalSkip(advanceIntervalRound);
  }, [applyIntervalSkip]);

  const startCircuitTransition = useCallback(
    (
      phase: Exclude<CircuitPhase, 'done'>,
      round = 1,
      overrides?: Partial<CircuitTimerConfig>,
      secondsOverride?: number,
    ) => {
      const state = createCircuitTimerState(phase, overrides, round);
      const secondsRemaining = secondsOverride ?? state.secondsRemaining;
      syncCircuitDeadline(secondsRemaining);
      setCircuitTimer({ ...state, secondsRemaining, running: true });
    },
    [syncCircuitDeadline],
  );

  const skipCircuitTimer = useCallback(() => {
    circuitDeadlineRef.current = null;
    setCircuitTimer((current) =>
      current ? { ...current, phase: 'done', running: false, secondsRemaining: 0 } : null,
    );
  }, []);

  const dismissCircuitTimer = useCallback(() => {
    circuitDeadlineRef.current = null;
    setCircuitTimer(null);
  }, []);

  const updateCircuitConfig = useCallback(
    (patch: Partial<CircuitTimerConfig>) => {
      setCircuitTimer((current) => {
        if (!current) return current;
        const config = { ...current.config, ...patch };
        if (current.phase === 'done') return { ...current, config };

        const previousTotal =
          current.phase === 'round_rest'
            ? current.config.restBetweenRoundsSeconds
            : current.config.restBetweenExercisesSeconds;
        const nextTotal =
          current.phase === 'round_rest'
            ? config.restBetweenRoundsSeconds
            : config.restBetweenExercisesSeconds;
        const secondsRemaining = Math.max(0, nextTotal - Math.max(0, previousTotal - current.secondsRemaining));
        if (current.running) syncCircuitDeadline(secondsRemaining);
        return { ...current, config, secondsRemaining };
      });
    },
    [syncCircuitDeadline],
  );

  /**
   * Pausing the workout must freeze its sub-timers too. Only timers this call paused are
   * resumed, so a timer the user paused by hand stays paused.
   */
  const setTimersPaused = useCallback(
    (paused: boolean) => {
      setIntervalTimer((current) => {
        if (!current || current.phase === 'done') return current;
        if (paused) {
          if (!current.running) return current;
          const remaining = readIntervalRemaining() ?? current.secondsRemaining;
          intervalDeadlineRef.current = null;
          intervalPausedBySessionRef.current = true;
          return { ...current, running: false, secondsRemaining: remaining };
        }
        if (current.running || !intervalPausedBySessionRef.current) return current;
        intervalPausedBySessionRef.current = false;
        syncIntervalDeadline(current.secondsRemaining);
        return { ...current, running: true };
      });

      setCircuitTimer((current) => {
        if (!current || current.phase === 'done') return current;
        if (paused) {
          if (!current.running) return current;
          const endAt = circuitDeadlineRef.current;
          const remaining =
            endAt == null ? current.secondsRemaining : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          circuitDeadlineRef.current = null;
          circuitPausedBySessionRef.current = true;
          return { ...current, running: false, secondsRemaining: remaining };
        }
        if (current.running || !circuitPausedBySessionRef.current) return current;
        circuitPausedBySessionRef.current = false;
        syncCircuitDeadline(current.secondsRemaining);
        return { ...current, running: true };
      });
    },
    [readIntervalRemaining, syncCircuitDeadline, syncIntervalDeadline],
  );

  return {
    setTimersPaused,
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
    updateCircuitConfig,
  };
}

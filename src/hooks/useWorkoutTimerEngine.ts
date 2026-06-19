import { useCallback, useEffect, useRef, useState } from 'react';

import { cueIntervalPhase } from '@/lib/intervalTimerFeedback';
import {
    skipIntervalRound as advanceIntervalRound,
    createCircuitTimerState,
    createIntervalTimerState,
    tickCircuitTimer,
    tickIntervalTimer,
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

  const syncIntervalDeadline = useCallback((secondsRemaining: number) => {
    intervalDeadlineRef.current = Date.now() + secondsRemaining * 1000;
  }, []);

  const syncCircuitDeadline = useCallback((secondsRemaining: number) => {
    circuitDeadlineRef.current = Date.now() + secondsRemaining * 1000;
  }, []);

  const readIntervalRemaining = useCallback(() => {
    const endAt = intervalDeadlineRef.current;
    if (!endAt) return 0;
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }, []);

  const readCircuitRemaining = useCallback(() => {
    const endAt = circuitDeadlineRef.current;
    if (!endAt) return 0;
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }, []);

  useEffect(() => {
    if (!intervalTimer?.running || intervalTimer.phase === 'done') return;

    const handle = setInterval(() => {
      setIntervalTimer((current) => {
        if (!current || !current.running || current.phase === 'done') return current;

        const remaining = readIntervalRemaining();
        if (remaining > 0) {
          if (current.secondsRemaining === remaining) return current;
          return { ...current, secondsRemaining: remaining };
        }

        const transitioned = tickIntervalTimer({ ...current, secondsRemaining: 0 });
        if (transitioned.phase === 'done') {
          intervalDeadlineRef.current = null;
          return transitioned;
        }

        const nextSeconds = secondsForPhase(transitioned);
        syncIntervalDeadline(nextSeconds);
        return { ...transitioned, secondsRemaining: nextSeconds };
      });
    }, TICK_MS);

    return () => clearInterval(handle);
  }, [intervalTimer?.running, intervalTimer?.phase, readIntervalRemaining, syncIntervalDeadline]);

  useEffect(() => {
    if (!circuitTimer?.running || circuitTimer.phase === 'done') return;

    const handle = setInterval(() => {
      setCircuitTimer((current) => {
        if (!current || !current.running || current.phase === 'done') return current;

        const remaining = readCircuitRemaining();
        if (remaining > 0) {
          if (current.secondsRemaining === remaining) return current;
          return { ...current, secondsRemaining: remaining };
        }

        const transitioned = tickCircuitTimer({ ...current, secondsRemaining: 0 });
        circuitDeadlineRef.current = null;
        return transitioned;
      });
    }, TICK_MS);

    return () => clearInterval(handle);
  }, [circuitTimer?.running, circuitTimer?.phase, readCircuitRemaining]);

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
    if (lastIntervalPhaseRef.current != null) {
      cueIntervalPhase(intervalTimer.phase, { speak: false });
    }
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
        const remaining = readIntervalRemaining() || current.secondsRemaining;
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
        const secondsRemaining =
          current.phase === 'work'
            ? config.workSeconds
            : current.phase === 'rest'
              ? config.restSeconds
              : current.secondsRemaining;
        if (current.running) syncIntervalDeadline(secondsRemaining);
        return { ...current, config, secondsRemaining };
      });
    },
    [syncIntervalDeadline],
  );

  const skipIntervalPhase = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || current.phase === 'done') return current;
      const transitioned = tickIntervalTimer({ ...current, secondsRemaining: 0, running: true });
      if (transitioned.phase === 'done') {
        intervalDeadlineRef.current = null;
        return transitioned;
      }
      const nextSeconds = secondsForPhase(transitioned);
      syncIntervalDeadline(nextSeconds);
      return { ...transitioned, secondsRemaining: nextSeconds, running: true };
    });
  }, [syncIntervalDeadline]);

  const skipIntervalRound = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || current.phase === 'done') return current;
      const transitioned = advanceIntervalRound(current);
      if (transitioned.phase === 'done') {
        intervalDeadlineRef.current = null;
        return transitioned;
      }
      const nextSeconds = secondsForPhase(transitioned);
      syncIntervalDeadline(nextSeconds);
      return { ...transitioned, secondsRemaining: nextSeconds, running: true };
    });
  }, [syncIntervalDeadline]);

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
        const secondsRemaining =
          current.phase === 'round_rest'
            ? config.restBetweenRoundsSeconds
            : config.restBetweenExercisesSeconds;
        if (current.running) syncCircuitDeadline(secondsRemaining);
        return { ...current, config, secondsRemaining };
      });
    },
    [syncCircuitDeadline],
  );

  return {
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

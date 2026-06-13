import { useCallback, useEffect, useState } from 'react';

import {
    createCircuitTimerState,
    createIntervalTimerState,
    tickCircuitTimer,
    tickIntervalTimer,
    type CircuitPhase,
    type CircuitTimerConfig,
    type CircuitTimerState,
    type IntervalTimerConfig,
    type IntervalTimerState,
} from '@/lib/timerEngine';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export function useWorkoutTimerEngine(executionMode: WorkoutExecutionMode) {
  const [intervalTimer, setIntervalTimer] = useState<IntervalTimerState | null>(null);
  const [circuitTimer, setCircuitTimer] = useState<CircuitTimerState | null>(null);

  useEffect(() => {
    if (!intervalTimer?.running || intervalTimer.phase === 'done') return;
    const handle = setInterval(() => {
      setIntervalTimer((current) => (current ? tickIntervalTimer(current) : null));
    }, 1000);
    return () => clearInterval(handle);
  }, [intervalTimer?.running, intervalTimer?.phase]);

  useEffect(() => {
    if (!circuitTimer?.running || circuitTimer.phase === 'done') return;
    const handle = setInterval(() => {
      setCircuitTimer((current) => (current ? tickCircuitTimer(current) : null));
    }, 1000);
    return () => clearInterval(handle);
  }, [circuitTimer?.running, circuitTimer?.phase]);

  const startIntervalTimer = useCallback(
    (overrides?: Partial<IntervalTimerConfig>) => {
      if (executionMode !== 'hiit' && executionMode !== 'tabata') return;
      setIntervalTimer(createIntervalTimerState(executionMode, overrides));
    },
    [executionMode],
  );

  const toggleIntervalTimer = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || current.phase === 'done') {
        if (executionMode !== 'hiit' && executionMode !== 'tabata') return current;
        const next = createIntervalTimerState(executionMode);
        return { ...next, running: true };
      }
      return { ...current, running: !current.running };
    });
  }, [executionMode]);

  const resetIntervalTimer = useCallback(() => {
    if (executionMode !== 'hiit' && executionMode !== 'tabata') return;
    setIntervalTimer(createIntervalTimerState(executionMode));
  }, [executionMode]);

  const updateIntervalConfig = useCallback((patch: Partial<IntervalTimerConfig>) => {
    setIntervalTimer((current) => {
      if (!current) return current;
      const config = { ...current.config, ...patch };
      const secondsRemaining =
        current.phase === 'work'
          ? config.workSeconds
          : current.phase === 'rest'
            ? config.restSeconds
            : current.secondsRemaining;
      return { ...current, config, secondsRemaining };
    });
  }, []);

  const skipIntervalPhase = useCallback(() => {
    setIntervalTimer((current) => {
      if (!current || current.phase === 'done') return current;
      return tickIntervalTimer({ ...current, secondsRemaining: 1, running: true });
    });
  }, []);

  const startCircuitTransition = useCallback(
    (
      phase: Exclude<CircuitPhase, 'done'>,
      round = 1,
      overrides?: Partial<CircuitTimerConfig>,
      secondsOverride?: number,
    ) => {
      const state = createCircuitTimerState(phase, overrides, round);
      setCircuitTimer(
        secondsOverride != null ? { ...state, secondsRemaining: secondsOverride } : state,
      );
    },
    [],
  );

  const skipCircuitTimer = useCallback(() => {
    setCircuitTimer((current) =>
      current ? { ...current, phase: 'done', running: false, secondsRemaining: 0 } : null,
    );
  }, []);

  const dismissCircuitTimer = useCallback(() => {
    setCircuitTimer(null);
  }, []);

  const updateCircuitConfig = useCallback((patch: Partial<CircuitTimerConfig>) => {
    setCircuitTimer((current) => {
      if (!current) return current;
      return { ...current, config: { ...current.config, ...patch } };
    });
  }, []);

  return {
    intervalTimer,
    circuitTimer,
    startIntervalTimer,
    toggleIntervalTimer,
    resetIntervalTimer,
    updateIntervalConfig,
    skipIntervalPhase,
    startCircuitTransition,
    skipCircuitTimer,
    dismissCircuitTimer,
    updateCircuitConfig,
  };
}

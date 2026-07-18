import { useEffect, useRef, useState } from 'react';

import { computeWorkoutElapsedSeconds } from '@/lib/workoutElapsed';

export { computeWorkoutElapsedSeconds } from '@/lib/workoutElapsed';

/**
 * Wall-clock elapsed seconds since workout started.
 * Paused time is excluded so resume does not jump by the pause duration.
 */
export function useWorkoutElapsedSeconds(startedAt: string | undefined, status: string | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const pausedAccumulatedMsRef = useRef(0);
  const pausedAtMsRef = useRef<number | null>(null);
  const lastStartedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      pausedAccumulatedMsRef.current = 0;
      pausedAtMsRef.current = null;
      lastStartedAtRef.current = undefined;
      return;
    }

    if (lastStartedAtRef.current !== startedAt) {
      lastStartedAtRef.current = startedAt;
      pausedAccumulatedMsRef.current = 0;
      pausedAtMsRef.current = null;
    }

    const startMs = new Date(startedAt).getTime();
    if (Number.isNaN(startMs)) {
      setElapsed(0);
      return;
    }

    if (status === 'paused') {
      if (pausedAtMsRef.current == null) {
        pausedAtMsRef.current = Date.now();
      }
      setElapsed(
        computeWorkoutElapsedSeconds({
          startedAtMs: startMs,
          nowMs: Date.now(),
          status,
          pausedAtMs: pausedAtMsRef.current,
          pausedAccumulatedMs: pausedAccumulatedMsRef.current,
        }),
      );
      return;
    }

    if (pausedAtMsRef.current != null) {
      pausedAccumulatedMsRef.current += Date.now() - pausedAtMsRef.current;
      pausedAtMsRef.current = null;
    }

    const tick = () => {
      setElapsed(
        computeWorkoutElapsedSeconds({
          startedAtMs: startMs,
          nowMs: Date.now(),
          status,
          pausedAccumulatedMs: pausedAccumulatedMsRef.current,
        }),
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);

  return elapsed;
}

export function formatWorkoutElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return '<1 min elapsed';
  return `${minutes} min elapsed`;
}

/** Sprint 5 — clock display for guided active workout (mm:ss). */
export function formatWorkoutClockTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

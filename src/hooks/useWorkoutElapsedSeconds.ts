import { useEffect, useState } from 'react';

/** Wall-clock elapsed seconds since workout started (pauses when session status is paused). */
export function useWorkoutElapsedSeconds(startedAt: string | undefined, status: string | undefined): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(startedAt).getTime();
    if (Number.isNaN(startMs)) {
      setElapsed(0);
      return;
    }

    if (status === 'paused') {
      return;
    }

    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
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

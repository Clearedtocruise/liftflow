import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
    loadPersistedCardioSession,
    savePersistedCardioSession,
    type PersistedCardioSession,
} from '@/lib/cardioSessionPersistence';

type CardioClockPersistence = {
  sessionId: string;
  activityId: string;
  activityLabel: string;
  activityType: string;
  activityMode: string;
  distanceMeters?: number;
};

type UseCardioSessionClockOptions = {
  persistence?: CardioClockPersistence;
  onRestore?: (session: PersistedCardioSession) => void;
};

/** Wall-clock cardio timer — survives screen lock and app backgrounding. */
export function useCardioSessionClock(options: UseCardioSessionClockOptions = {}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const sessionStartedAtRef = useRef<number | null>(null);
  const pausedTotalMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const restoredRef = useRef(false);

  const computeElapsed = useCallback(() => {
    if (!sessionStartedAtRef.current) return 0;
    const now = Date.now();
    const activePauseMs = pausedAtRef.current ? now - pausedAtRef.current : 0;
    const totalPausedMs = pausedTotalMsRef.current + activePauseMs;
    return Math.max(0, Math.floor((now - sessionStartedAtRef.current - totalPausedMs) / 1000));
  }, []);

  const syncElapsed = useCallback(() => {
    setElapsed(computeElapsed());
  }, [computeElapsed]);

  useEffect(() => {
    if (!running) return;
    syncElapsed();
    const timer = setInterval(syncElapsed, 1000);
    return () => clearInterval(timer);
  }, [running, syncElapsed]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncElapsed();
    });
    return () => subscription.remove();
  }, [syncElapsed]);

  const persist = useCallback(
  async (distanceMeters = 0) => {
    if (!options.persistence || !sessionStartedAtRef.current) {
      return;
    }
    await savePersistedCardioSession({
      sessionId: options.persistence.sessionId,
      activityId: options.persistence.activityId,
      activityLabel: options.persistence.activityLabel,
      activityType: options.persistence.activityType,
      activityMode: options.persistence.activityMode,
      sessionStartedAt: sessionStartedAtRef.current,
      pausedTotalMs: pausedTotalMsRef.current,
      pausedAt: pausedAtRef.current,
      running,
      distanceMeters,
      savedAt: Date.now(),
    });
  },
  [options.persistence, running],
  );

  useEffect(() => {
    if (restoredRef.current || !options.persistence) return;
    restoredRef.current = true;
    void (async () => {
      const saved = await loadPersistedCardioSession();
      if (!saved || saved.sessionId !== options.persistence?.sessionId) return;
      sessionStartedAtRef.current = saved.sessionStartedAt;
      pausedTotalMsRef.current = saved.pausedTotalMs;
      pausedAtRef.current = saved.pausedAt;
      setRunning(saved.running);
      setElapsed(
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              saved.sessionStartedAt -
              saved.pausedTotalMs -
              (saved.pausedAt ? Date.now() - saved.pausedAt : 0)) /
              1000,
          ),
        ),
      );
      options.onRestore?.(saved);
    })();
  }, [options]);

  useEffect(() => {
    if (!sessionStartedAtRef.current) return;
    void persist();
  }, [running, elapsed, persist]);

  function start() {
    if (!sessionStartedAtRef.current) {
      sessionStartedAtRef.current = Date.now();
    }
    if (pausedAtRef.current) {
      pausedTotalMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    setRunning(true);
    syncElapsed();
  }

  function pause() {
    if (running && pausedAtRef.current == null) {
      pausedAtRef.current = Date.now();
    }
    setRunning(false);
    syncElapsed();
  }

  function reset() {
    sessionStartedAtRef.current = null;
    pausedTotalMsRef.current = 0;
    pausedAtRef.current = null;
    setRunning(false);
    setElapsed(0);
    void savePersistedCardioSession(null);
  }

  function getStartedAt(): number | null {
    return sessionStartedAtRef.current;
  }

  function getElapsedForSave(): number {
    return computeElapsed();
  }

  function getSessionStartedAtIso(): string | undefined {
    if (!sessionStartedAtRef.current) return undefined;
    return new Date(sessionStartedAtRef.current).toISOString();
  }

  return {
    running,
    elapsed,
    start,
    pause,
    reset,
    syncElapsed,
    getStartedAt,
    getElapsedForSave,
    getSessionStartedAtIso,
    persist,
    setRunning,
    setElapsed,
  };
}

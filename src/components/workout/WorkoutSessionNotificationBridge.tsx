import { useEffect } from 'react';
import { AppState } from 'react-native';

import { setForegroundWorkoutActive } from '@/lib/workoutNotificationGuard';
import { workoutSessionNotificationService } from '@/services/workoutSessionNotificationService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

const FOREGROUND_SWEEP_MS = 3_000;

function isLiveWorkout(session: ReturnType<typeof useWorkoutSession>['activeSession']): boolean {
  return !!session && session.status !== 'cancelled' && session.status !== 'completed';
}

/** Clears workout notifications while the app is open. Does not schedule any. */
export function WorkoutSessionNotificationBridge() {
  const { activeSession } = useWorkoutSession();
  const liveWorkout = isLiveWorkout(activeSession);

  useEffect(() => {
    setForegroundWorkoutActive(liveWorkout && AppState.currentState === 'active');
    void workoutSessionNotificationService.clear();

    const sub = AppState.addEventListener('change', (state) => {
      setForegroundWorkoutActive(liveWorkout && state === 'active');
      if (state === 'active') {
        void workoutSessionNotificationService.clear();
      }
    });

    return () => {
      sub.remove();
      setForegroundWorkoutActive(false);
      void workoutSessionNotificationService.clear();
    };
  }, [liveWorkout, activeSession?.id]);

  useEffect(() => {
    if (!liveWorkout) return;

    const sweep = setInterval(() => {
      if (AppState.currentState === 'active') {
        void workoutSessionNotificationService.clear();
      }
    }, FOREGROUND_SWEEP_MS);

    return () => clearInterval(sweep);
  }, [liveWorkout, activeSession?.id]);

  return null;
}

import { useEffect } from 'react';

import { useVoiceWorkout } from './useVoiceWorkout';

/** Keeps wake-word listening active outside workouts when Gym Mode is enabled. */
export function useGymModeVoiceScope(enabled: boolean) {
  const { setGymModeActive } = useVoiceWorkout();

  useEffect(() => {
    setGymModeActive(enabled);
    return () => setGymModeActive(false);
  }, [enabled, setGymModeActive]);
}

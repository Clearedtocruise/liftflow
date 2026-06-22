import { useContext } from 'react';

import { VoiceWorkoutContext } from './VoiceWorkoutProvider';

export function useVoiceWorkout() {
  const context = useContext(VoiceWorkoutContext);
  if (!context) {
    throw new Error('useVoiceWorkout must be used inside VoiceWorkoutProvider');
  }
  return context;
}

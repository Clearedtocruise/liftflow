import { useEffect } from 'react';

import { loadVoiceSettings } from '@/services/voiceService';

import { useVoiceWorkout } from './useVoiceWorkout';

/** Syncs persisted voice settings into VoiceWorkoutProvider when user loads. */
export function VoiceWorkoutSettingsBridge({ userId }: { userId?: string }) {
  const { setWakePhraseSettingEnabled, setVoiceFeedbackEnabled } = useVoiceWorkout();

  useEffect(() => {
    if (!userId) return;
    void loadVoiceSettings(userId).then((settings) => {
      setWakePhraseSettingEnabled(settings.wakePhraseEnabled);
      setVoiceFeedbackEnabled(settings.voiceFeedback);
    });
  }, [userId, setWakePhraseSettingEnabled, setVoiceFeedbackEnabled]);

  return null;
}

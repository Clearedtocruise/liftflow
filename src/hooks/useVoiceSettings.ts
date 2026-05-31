import { useCallback, useEffect, useState } from 'react';

import { voiceSettingsFromUser } from '@/lib/voice/voicePreferences';
import { userService } from '@/services/userService';
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/types/voice';

export function useVoiceSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSettings(DEFAULT_VOICE_SETTINGS);
      return;
    }
    setLoading(true);
    const [profile, prefs] = await Promise.all([
      userService.getProfile(userId),
      userService.getPreferences(userId),
    ]);
    setSettings(
      voiceSettingsFromUser(profile.success ? profile.data : null, prefs.success ? prefs.data : null),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}

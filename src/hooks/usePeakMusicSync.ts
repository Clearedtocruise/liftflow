import { useCallback, useState } from 'react';

import { peakMusicService } from '@/services/peakMusicService';
import type { PeakMusicSettings } from '@/types/peakMusic';
import { DEFAULT_PEAK_MUSIC_SETTINGS } from '@/types/peakMusic';

export function usePeakMusicSync(userId: string | undefined) {
  const [settings, setSettings] = useState<PeakMusicSettings>(() =>
    userId ? peakMusicService.getSettings(userId) : { ...DEFAULT_PEAK_MUSIC_SETTINGS },
  );

  const updateSettings = useCallback(
    (patch: Partial<PeakMusicSettings>) => {
      if (!userId) return;
      setSettings(peakMusicService.updateSettings(userId, patch));
    },
    [userId],
  );

  return { settings, updateSettings, peakMusicService };
}

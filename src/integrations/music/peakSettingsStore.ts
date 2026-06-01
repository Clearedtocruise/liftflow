import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PeakMusicSettings } from '@/types/peakMusic';
import { DEFAULT_PEAK_MUSIC_SETTINGS } from '@/types/peakMusic';

const STORAGE_KEY = '@liftflow/peak_music_settings';

export const peakSettingsStore = {
  async get(userId: string): Promise<PeakMusicSettings | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, PeakMusicSettings>;
    return all[userId] ?? null;
  },

  async save(userId: string, settings: PeakMusicSettings): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: Record<string, PeakMusicSettings> = raw ? JSON.parse(raw) : {};
    all[userId] = settings;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },
};

export async function loadPeakSettings(userId: string): Promise<PeakMusicSettings> {
  const stored = await peakSettingsStore.get(userId);
  return stored ?? { ...DEFAULT_PEAK_MUSIC_SETTINGS };
}

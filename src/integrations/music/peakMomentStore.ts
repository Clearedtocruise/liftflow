import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MusicProviderId, PeakMoment } from '@/types/peakMusic';

const STORAGE_KEY = '@liftflow/peak_moments';

function key(userId: string, provider: MusicProviderId, trackId: string): string {
  return `${userId}:${provider}:${trackId}`;
}

/** Local peak marker store — canonical when provider does not support custom timestamps */
export const peakMomentStore = {
  async list(userId: string): Promise<PeakMoment[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as PeakMoment[];
    return all.filter((m) => m.userId === userId);
  },

  async get(userId: string, provider: MusicProviderId, trackId: string): Promise<PeakMoment | null> {
    const list = await this.list(userId);
    return list.find((m) => m.provider === provider && m.trackId === trackId) ?? null;
  },

  async save(moment: PeakMoment): Promise<PeakMoment> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: PeakMoment[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(
      (m) =>
        m.userId === moment.userId && m.provider === moment.provider && m.trackId === moment.trackId,
    );
    const next = { ...moment, updatedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return next;
  },

  async remove(userId: string, provider: MusicProviderId, trackId: string): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = (JSON.parse(raw) as PeakMoment[]).filter(
      (m) => !(m.userId === userId && m.provider === provider && m.trackId === trackId),
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  buildId(userId: string, provider: MusicProviderId, trackId: string): string {
    return key(userId, provider, trackId);
  },
};

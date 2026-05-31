import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MusicProviderId, PlaylistSnapshot } from '@/types/peakMusic';

const SNAPSHOT_KEY = '@liftflow/playlist_snapshot';
const QUEUE_KEY = '@liftflow/workout_music_queue';

export const playlistStateStore = {
  async saveSnapshot(userId: string, snapshot: PlaylistSnapshot): Promise<void> {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    const all: Record<string, PlaylistSnapshot> = raw ? JSON.parse(raw) : {};
    all[userId] = snapshot;
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
  },

  async getSnapshot(userId: string): Promise<PlaylistSnapshot | null> {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, PlaylistSnapshot>;
    return all[userId] ?? null;
  },

  async clearSnapshot(userId: string): Promise<void> {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, PlaylistSnapshot>;
    delete all[userId];
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
  },

  async saveWorkoutQueue<T extends { userId: string }>(queue: T): Promise<void> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const all: Record<string, T> = raw ? JSON.parse(raw) : {};
    all[queue.userId] = queue;
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all));
  },

  async getWorkoutQueue<T>(userId: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, T>;
    return all[userId] ?? null;
  },
};

export function snapshotKey(provider: MusicProviderId, contextId?: string): string {
  return `${provider}:${contextId ?? 'now_playing'}`;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BodyCompositionRecord, ProgressPhoto, WorkoutHistoryItem } from '@/types';
import type { TransformationProjection } from '@/types/transformation';

type CacheEnvelope<T> = {
  savedAt: string;
  data: T;
};

const memory = new Map<string, string>();

function key(userId: string, screen: string): string {
  return `@liftflow/screen/${screen}/${userId}`;
}

async function readJson<T>(cacheKey: string): Promise<T | null> {
  const mem = memory.get(cacheKey);
  const raw = mem ?? (await AsyncStorage.getItem(cacheKey));
  if (!raw) return null;
  if (!mem) memory.set(cacheKey, raw);
  try {
    return (JSON.parse(raw) as CacheEnvelope<T>).data ?? null;
  } catch {
    return null;
  }
}

async function writeJson<T>(cacheKey: string, data: T): Promise<void> {
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), data } satisfies CacheEnvelope<T>);
  memory.set(cacheKey, payload);
  await AsyncStorage.setItem(cacheKey, payload);
}

export type ProgressSnapshot = {
  photos: ProgressPhoto[];
  measurements: BodyCompositionRecord[];
  transformation: TransformationProjection | null;
};

export type HistorySnapshot = {
  items: WorkoutHistoryItem[];
  streak: number;
};

export const screenDataCache = {
  async readProgress(userId: string): Promise<ProgressSnapshot | null> {
    return readJson<ProgressSnapshot>(key(userId, 'progress'));
  },

  writeProgress(userId: string, snapshot: ProgressSnapshot): void {
    void writeJson(key(userId, 'progress'), snapshot);
  },

  prefetchProgress(userId: string): void {
    void this.readProgress(userId);
  },

  async readHistory(userId: string): Promise<HistorySnapshot | null> {
    return readJson<HistorySnapshot>(key(userId, 'history'));
  },

  writeHistory(userId: string, snapshot: HistorySnapshot): void {
    void writeJson(key(userId, 'history'), snapshot);
  },

  prefetchHistory(userId: string): void {
    void this.readHistory(userId);
  },
};

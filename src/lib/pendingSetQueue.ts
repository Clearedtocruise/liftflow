import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CreateSetPayload } from '@/types';

const STORAGE_KEY = '@liftflow/pending_workout_sets';
const MAX_ITEMS = 40;

export type PendingSetRecord = {
  id: string;
  sessionId: string;
  payload: CreateSetPayload;
  createdAt: string;
  attempts: number;
};

export const pendingSetQueue = {
  async list(): Promise<PendingSetRecord[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingSetRecord[];
    return parsed.filter((item) => item?.id && item?.sessionId && item?.payload);
  },

  async count(): Promise<number> {
    return (await this.list()).length;
  },

  async countForSession(sessionId: string): Promise<number> {
    return (await this.list()).filter((item) => item.sessionId === sessionId).length;
  },

  async purgeSession(sessionId: string): Promise<void> {
    const all = await this.list();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.filter((item) => item.sessionId !== sessionId)),
    );
  },

  async enqueue(sessionId: string, payload: CreateSetPayload): Promise<string> {
    const all = await this.list();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    all.push({
      id,
      sessionId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-MAX_ITEMS)));
    return id;
  },

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((item) => item.id !== id)));
  },

  async markAttempt(id: string): Promise<void> {
    const all = await this.list();
    const next = all.map((item) => (item.id === id ? { ...item, attempts: item.attempts + 1 } : item));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
};

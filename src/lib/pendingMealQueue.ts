import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MealType } from '@/types/common';

const STORAGE_KEY = '@liftflow/pending_meal_logs';
const MAX_ITEMS = 40;

export type PendingMealPayload = {
  name: string;
  mealType: MealType;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  date?: string;
  instructions?: string;
};

export type PendingMealRecord = {
  id: string;
  userId: string;
  payload: PendingMealPayload;
  createdAt: string;
  attempts: number;
};

export const pendingMealQueue = {
  async list(): Promise<PendingMealRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingMealRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item?.id && item?.userId && item?.payload?.name);
    } catch {
      return [];
    }
  },

  async countForUser(userId: string): Promise<number> {
    return (await this.list()).filter((item) => item.userId === userId).length;
  },

  async enqueue(userId: string, payload: PendingMealPayload): Promise<string> {
    const all = await this.list();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    all.push({
      id,
      userId,
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

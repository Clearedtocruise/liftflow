import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@liftflow/watch_offline_queue';

export type QueuedWatchMessage = {
  id: string;
  message: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

export const watchOfflineQueue = {
  async list(): Promise<QueuedWatchMessage[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWatchMessage[]) : [];
  },

  async enqueue(message: Record<string, unknown>): Promise<void> {
    const all = await this.list();
    all.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-50)));
  },

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.filter((m) => m.id !== id)),
    );
  },

  async markAttempt(id: string): Promise<void> {
    const all = await this.list();
    const next = all.map((m) => (m.id === id ? { ...m, attempts: m.attempts + 1 } : m));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
};

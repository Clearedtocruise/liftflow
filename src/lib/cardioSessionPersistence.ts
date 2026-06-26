import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'liftflow_active_cardio_session_v1';

export type PersistedCardioSession = {
  sessionId: string;
  activityId: string;
  activityLabel: string;
  activityType: string;
  activityMode: string;
  sessionStartedAt: number;
  pausedTotalMs: number;
  pausedAt: number | null;
  running: boolean;
  distanceMeters: number;
  savedAt: number;
};

export async function loadPersistedCardioSession(): Promise<PersistedCardioSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCardioSession;
    if (!parsed.sessionStartedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistedCardioSession(session: PersistedCardioSession | null): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {
    // Non-fatal — wall-clock timer still works within the same app session.
  }
}

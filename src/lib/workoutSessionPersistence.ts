import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'liftflow_workout_session_progress_v1';

type SavedWorkoutProgress = {
  sessionId: string;
  exerciseIndex: number;
  savedAt: number;
};

export async function loadWorkoutProgress(sessionId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWorkoutProgress;
    if (parsed.sessionId !== sessionId) return null;
    if (!Number.isFinite(parsed.exerciseIndex)) return null;
    return parsed.exerciseIndex;
  } catch {
    return null;
  }
}

export async function saveWorkoutProgress(sessionId: string, exerciseIndex: number): Promise<void> {
  try {
    const payload: SavedWorkoutProgress = {
      sessionId,
      exerciseIndex,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal — in-session navigation still works.
  }
}

export async function clearWorkoutProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

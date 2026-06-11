import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from '@/types/user';

const CACHE_KEY = 'liftflow_profile_cache_v1';

type CachedProfile = {
  userId: string;
  profile: UserProfile;
  cachedAt: string;
};

export async function readCachedProfile(userId: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (parsed.userId !== userId) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

export async function writeCachedProfile(profile: UserProfile): Promise<void> {
  try {
    const payload: CachedProfile = {
      userId: profile.id,
      profile,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // non-fatal
  }
}

export async function clearCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // non-fatal
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultThemeId, type ThemeId } from '@/constants/themes';

export const APPEARANCE_THEME_KEY = 'appearanceThemeId';

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'dark-classic' || value === 'light-professional';
}

export async function loadAppearanceThemeId(): Promise<ThemeId> {
  try {
    const raw = await AsyncStorage.getItem(APPEARANCE_THEME_KEY);
    return isThemeId(raw) ? raw : defaultThemeId;
  } catch {
    return defaultThemeId;
  }
}

export async function saveAppearanceThemeId(id: ThemeId): Promise<void> {
  await AsyncStorage.setItem(APPEARANCE_THEME_KEY, id);
}

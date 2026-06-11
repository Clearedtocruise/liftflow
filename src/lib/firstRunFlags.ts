import AsyncStorage from '@react-native-async-storage/async-storage';

const NAV_INTRO_KEY = 'liftflow_has_seen_navigation_intro';

export async function hasSeenNavigationIntro(): Promise<boolean> {
  const value = await AsyncStorage.getItem(NAV_INTRO_KEY);
  return value === 'true';
}

export async function markNavigationIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(NAV_INTRO_KEY, 'true');
}

export async function resetNavigationIntroForDev(): Promise<void> {
  await AsyncStorage.removeItem(NAV_INTRO_KEY);
}

export async function clearNavigationIntroFlag(): Promise<void> {
  await AsyncStorage.removeItem(NAV_INTRO_KEY);
}

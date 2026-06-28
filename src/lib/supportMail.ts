import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const SUPPORT_EMAIL = 'support@liftflow.app';

export async function openSupportEmail(subject = 'ONE MORE Support'): Promise<boolean> {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode ??
    'unknown';

  const body = `\n\n---\nApp: ONE MORE ${appVersion} (${build})\nPlatform: ${Platform.OS}\n`;

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

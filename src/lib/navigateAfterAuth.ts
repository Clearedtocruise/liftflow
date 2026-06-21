import { router } from 'expo-router';
import { InteractionManager } from 'react-native';

import type { UserProfile } from '@/types/user';

/** Post-auth destination from a loaded profile row. */
export function authHomeRoute(
  profile: Pick<UserProfile, 'onboardingCompleted'>,
): '/(tabs)/dashboard' | '/(onboarding)/legal' {
  return profile.onboardingCompleted ? '/(tabs)/dashboard' : '/(onboarding)/legal';
}

/**
 * Leave the auth stack after sign-in. Routes through `/` so the same index gate
 * that runs on cold start picks dashboard vs onboarding — nested `<Redirect>`
 * from `(auth)/login` is unreliable on device.
 */
export async function navigateAfterAuth(): Promise<void> {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  router.replace('/');
}

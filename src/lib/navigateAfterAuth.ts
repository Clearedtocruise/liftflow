import { router } from 'expo-router';

import type { UserProfile } from '@/types/user';

/** Post-auth destination from a loaded profile row. */
export function authHomeRoute(
  profile: Pick<UserProfile, 'onboardingCompleted'>,
): '/(tabs)/dashboard' | '/(onboarding)/legal' {
  return profile.onboardingCompleted ? '/(tabs)/dashboard' : '/(onboarding)/legal';
}

/** Jump straight to home — avoid routing through `/` (extra splash hop). */
export function navigateAfterAuth(profile: Pick<UserProfile, 'onboardingCompleted'>): void {
  router.replace(authHomeRoute(profile));
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logTabDiagnostic } from '@/lib/tabDiagnostics';
import { userService } from '@/services/userService';
import { workoutService } from '@/services/workoutService';
import { supabase } from '@/supabase/client';

/** Preserve Supabase auth tokens (keys start with sb-). */
async function clearLocalAppStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => !key.startsWith('sb-'));
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}

async function resetServerUserState(userId: string): Promise<void> {
  const cancelResult = await workoutService.cancelAllActiveSessions(userId);
  if (!cancelResult.success) {
    throw new Error(cancelResult.error);
  }

  const profileResult = await userService.updateProfile(userId, {
    onboardingCompleted: false,
    metadata: {},
  });
  if (!profileResult.success) {
    throw new Error(profileResult.error);
  }

  const { error: programError } = await supabase
    .from('training_programs')
    .update({ is_active: false })
    .eq('user_id', userId);
  if (programError) {
    throw new Error(programError.message);
  }

  const { error: plannedError } = await supabase
    .from('planned_workouts')
    .update({ status: 'planned' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (plannedError) {
    throw new Error(plannedError.message);
  }
}

/**
 * Return the app to a first-launch experience while keeping the signed-in account.
 * Clears local caches/flags, cancels in-progress workouts, and restarts onboarding.
 */
export async function factoryReset(userId: string): Promise<void> {
  logTabDiagnostic('RESET_STARTED', { userId, screen: 'settings' });
  try {
    await clearLocalAppStorage();
    await resetServerUserState(userId);
    logTabDiagnostic('RESET_COMPLETED', { userId, screen: 'settings' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Factory reset failed';
    logTabDiagnostic('RESET_FAILED', { userId, screen: 'settings', error: message });
    throw new Error(message);
  }
}

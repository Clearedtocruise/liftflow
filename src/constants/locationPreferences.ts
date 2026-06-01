/** Keys stored in user_preferences.privacy_settings */
export const PRIVACY_WORKOUT_LOCATION_DETECTION = 'workoutLocationDetection' as const;

export function isWorkoutLocationDetectionEnabled(
  privacySettings: Record<string, unknown> | undefined,
): boolean {
  if (!privacySettings) return true;
  const value = privacySettings[PRIVACY_WORKOUT_LOCATION_DETECTION];
  if (value === false) return false;
  return true;
}

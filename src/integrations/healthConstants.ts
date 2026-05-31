/** Canonical health metric types synced from Apple Health / Health Connect */

export const HEALTH_DATA_TYPES = [
  'heart_rate',
  'resting_heart_rate',
  'hrv',
  'active_calories',
  'workout_session',
  'sleep',
  'steps',
  'weight',
] as const;

export type HealthDataType = (typeof HEALTH_DATA_TYPES)[number];

export const HEALTHKIT_READ_PERMISSIONS = {
  quantity: [
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierRestingHeartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    'HKQuantityTypeIdentifierDistanceWalkingRunning',
    'HKQuantityTypeIdentifierAppleExerciseTime',
  ],
  category: ['HKCategoryTypeIdentifierSleepAnalysis'],
  workout: ['HKWorkoutTypeIdentifier'],
} as const;

export const HEALTH_DATA_LABELS: Record<HealthDataType, string> = {
  heart_rate: 'Heart Rate',
  resting_heart_rate: 'Resting Heart Rate',
  hrv: 'Heart Rate Variability',
  active_calories: 'Active Calories',
  workout_session: 'Workouts',
  sleep: 'Sleep',
  steps: 'Steps',
  weight: 'Weight',
};

export type HealthPermissionStatus = 'unknown' | 'authorized' | 'denied' | 'unavailable';

export type HealthSyncConflictPolicy = 'latest_wins' | 'healthkit_wins' | 'manual_wins';

/** Normalized health metric from HealthKit, Health Connect, or Watch */
export type HealthMetricSample = {
  dataType: string;
  externalId?: string;
  value: Record<string, unknown>;
  recordedAt: string;
  unit?: string;
};

export type HealthSyncResult = {
  synced: number;
  dataTypes: string[];
  errors: string[];
};

export type StravaActivity = {
  externalId: string;
  name: string;
  type: string;
  startedAt: string;
  durationSeconds: number;
  distanceMeters?: number;
  calories?: number;
  avgPaceSecPerKm?: number;
  avgHeartRate?: number;
  elevationGainM?: number;
};

export type WatchSyncPayload = {
  workoutSessionId?: string;
  startedAt: string;
  endedAt?: string;
  heartRateSamples: { recordedAt: string; bpm: number }[];
  steps?: number;
  activeCalories?: number;
  distanceMeters?: number;
  motionSummary?: Record<string, unknown>;
};

export type IntegrationAvailability = {
  available: boolean;
  reason?: string;
};

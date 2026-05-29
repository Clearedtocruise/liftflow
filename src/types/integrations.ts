import type { BaseEntity, CardioType } from './common';

export type CardioSession = BaseEntity & {
  userId: string;
  workoutSessionId?: string;
  cardioType: CardioType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  avgPaceSecPerKm?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  elevationGainM?: number;
  notes?: string;
};

export type HeartRateSample = BaseEntity & {
  userId: string;
  sessionId?: string;
  sessionType?: 'workout' | 'cardio' | 'rest' | 'daily';
  recordedAt: string;
  bpm: number;
  source: string;
};

export type WatchSession = BaseEntity & {
  userId: string;
  workoutSessionId?: string;
  startedAt: string;
  endedAt?: string;
  heartRateSamples: HeartRateSample[];
  motionSummary: Record<string, unknown>;
};

export type MotionSample = BaseEntity & {
  userId: string;
  sessionId?: string;
  recordedAt: string;
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  movementCategory?: import('./common').MovementCategory;
};

export type RepCountEvent = BaseEntity & {
  userId: string;
  workoutSetId?: string;
  detectedReps: number;
  confidence?: number;
  confirmedReps?: number;
  isConfirmed: boolean;
  detectedAt: string;
};

export type ExerciseRecognitionEvent = BaseEntity & {
  userId: string;
  sessionId?: string;
  suggestedExerciseId?: string;
  suggestedName: string;
  confidence?: number;
  movementCategory?: import('./common').MovementCategory;
  isConfirmed: boolean;
  detectedAt: string;
};

export type IntegrationConnection = BaseEntity & {
  userId: string;
  provider: import('./common').IntegrationProvider;
  isConnected: boolean;
  scopes: string[];
  lastSyncAt?: string;
  syncStatus: import('./common').SyncStatus;
};

export type HealthKitSyncRecord = BaseEntity & {
  userId: string;
  dataType: string;
  externalId?: string;
  value: Record<string, unknown>;
  recordedAt: string;
  syncedAt: string;
};

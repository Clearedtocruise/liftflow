import type { MovementCategory } from '@/types/common';

/** Single IMU reading from Apple Watch (CoreMotion). */
export type WatchMotionSample = {
  recordedAt: number;
  accelerometer: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
};

export type ExerciseMotionProfile = {
  id: string;
  displayName: string;
  aliases: string[];
  movementCategory: MovementCategory;
  /** How to derive the 1D rep signal from accelerometer. */
  signalMode: 'magnitude' | 'axis_y' | 'axis_z' | 'gyro_magnitude';
  minPeakIntervalMs: number;
  maxPeakIntervalMs: number;
  /** Peak must exceed rolling mean + prominence × rolling std. */
  peakProminence: number;
  /** Baseline confidence when motion pattern matches well. */
  baselineConfidence: number;
  targetRepsDefault: number;
  targetSetsDefault: number;
};

export type RepDetectionResult = {
  detectedReps: number;
  confidence: number;
  supported: boolean;
  needsConfirmation: boolean;
  reason?: string;
};

export type WatchActiveSetState = {
  workoutSessionId: string;
  workoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseProfileId: string | null;
  setNumber: number;
  targetSets: number;
  targetReps: number;
  currentRepCount: number;
  motionConfidence: number;
  needsConfirmation: boolean;
  weightLbs?: number;
  restSecondsRemaining?: number;
  phase: 'active_set' | 'rest' | 'between_sets' | 'idle';
  /** A1, B2, etc. during supersets */
  stationLabel?: string;
  /** e.g. A1 · Set 2/3 */
  statusLine?: string;
  /** Partner / next station during superset rotation */
  supersetHint?: string;
};

export type WatchWorkoutAssistantState = {
  userId: string;
  activeSet: WatchActiveSetState | null;
  /** Recovery intelligence score 0–100 */
  recoveryScore?: number;
  recoveryLabel?: string;
  /** Today's training recommendation line */
  workoutRecommendation?: string;
  /** Smart progression hint for active exercise */
  progressionLine?: string;
  healthSnapshot?: WatchHealthSnapshot;
  lastSpokenResponse?: string;
  updatedAt: string;
};

export type WatchHealthSnapshot = {
  heartRateBpm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  activeCalories?: number;
  sessionCalories?: number;
  sleepHours?: number;
  steps?: number;
  syncedAt?: string;
};

/** Live cardio session mirrored to Apple Watch during phone-led cardio. */
export type WatchCardioState = {
  sessionId: string;
  activityLabel: string;
  activityType: string;
  running: boolean;
  elapsedSeconds: number;
  sessionStartedAt?: string;
  pausedTotalMs?: number;
  distanceMeters?: number;
  paceLabel?: string | null;
  speedLabel?: string | null;
  calories?: number;
  heartRateBpm?: number;
  phaseLabel?: string;
  updatedAt: string;
};

export type WatchVoiceCommandResult = {
  intent: string;
  spokenResponse: string;
  state?: Partial<WatchActiveSetState>;
  shouldLogSet?: boolean;
};

/** WatchConnectivity message envelope (phone ↔ watch). */
export type WatchWorkoutMessage =
  | { type: 'workout_state'; state: WatchWorkoutAssistantState }
  | { type: 'motion_batch'; samples: WatchMotionSample[]; workoutSessionId: string }
  | { type: 'voice_command'; transcript: string; workoutSessionId?: string }
  | { type: 'rep_correction'; repCount: number; workoutSessionId: string; workoutExerciseId: string }
  | { type: 'confirm_reps'; workoutSessionId: string; workoutExerciseId: string }
  | { type: 'skip_rest'; workoutSessionId?: string }
  | { type: 'next_set'; workoutSessionId?: string }
  | { type: 'log_set'; workoutSessionId?: string }
  | { type: 'start_workout'; workoutSessionId?: string }
  | { type: 'cancel_workout'; workoutSessionId?: string }
  | { type: 'set_weight'; weightLbs: number; workoutSessionId?: string }
  | { type: 'workout_sync'; [key: string]: unknown }
  | { type: 'cardio_state'; state: WatchCardioState; presentWorkout?: boolean }
  | { type: 'cardio_pause' }
  | { type: 'cardio_resume' }
  | { type: 'cardio_finish' }
  | { type: 'heart_rate_sample'; bpm: number; recordedAt: string };

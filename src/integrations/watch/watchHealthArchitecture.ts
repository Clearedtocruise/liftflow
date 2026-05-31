/**
 * Apple Watch health architecture (phone-side).
 * Native watchOS companion is NOT deployed in Sprint 7.4 — this module defines
 * contracts and phone handlers for future Watch app integration.
 */

export type WatchWorkoutDetectionState = 'idle' | 'warming_up' | 'active' | 'resting' | 'cooldown' | 'ended';

export type WatchHeartRateReading = {
  recordedAt: string;
  bpm: number;
  source: 'apple_watch' | 'healthkit';
};

export type WatchMovementEvent = {
  recordedAt: string;
  category: 'stationary' | 'walking' | 'running' | 'lifting' | 'unknown';
  confidence: number;
  accelerometerMagnitude?: number;
};

export type WatchWorkoutDetectionPayload = {
  state: WatchWorkoutDetectionState;
  startedAt?: string;
  endedAt?: string;
  detectedActivity?: string;
  heartRate?: WatchHeartRateReading;
  movement?: WatchMovementEvent;
};

export type WatchHealthArchitecture = {
  /** Watch → Phone: workout session started/ended */
  onWorkoutDetection: (payload: WatchWorkoutDetectionPayload) => void;
  /** Watch → Phone: streaming HR during workout */
  onHeartRateSample: (sample: WatchHeartRateReading) => void;
  /** Watch → Phone: motion classification batch */
  onMovementEvent: (event: WatchMovementEvent) => void;
};

export const WATCH_MESSAGE_TYPES = {
  WORKOUT_DETECTION: 'workout_detection',
  HEART_RATE: 'heart_rate_sample',
  MOVEMENT: 'movement_event',
  WORKOUT_SYNC: 'workout_sync',
  REQUEST_SYNC: 'request_sync',
} as const;

export function parseWatchWorkoutDetection(raw: Record<string, unknown>): WatchWorkoutDetectionPayload | null {
  if (raw.type !== WATCH_MESSAGE_TYPES.WORKOUT_DETECTION) return null;
  return {
    state: (raw.state as WatchWorkoutDetectionState) ?? 'idle',
    startedAt: raw.startedAt ? String(raw.startedAt) : undefined,
    endedAt: raw.endedAt ? String(raw.endedAt) : undefined,
    detectedActivity: raw.detectedActivity ? String(raw.detectedActivity) : undefined,
    heartRate: raw.heartRate as WatchHeartRateReading | undefined,
    movement: raw.movement as WatchMovementEvent | undefined,
  };
}

export function parseWatchHeartRate(raw: Record<string, unknown>): WatchHeartRateReading | null {
  if (raw.type !== WATCH_MESSAGE_TYPES.HEART_RATE) return null;
  const bpm = Number(raw.bpm);
  if (!Number.isFinite(bpm)) return null;
  return {
    recordedAt: String(raw.recordedAt ?? new Date().toISOString()),
    bpm,
    source: 'apple_watch',
  };
}

export function parseWatchMovement(raw: Record<string, unknown>): WatchMovementEvent | null {
  if (raw.type !== WATCH_MESSAGE_TYPES.MOVEMENT) return null;
  return {
    recordedAt: String(raw.recordedAt ?? new Date().toISOString()),
    category: (raw.category as WatchMovementEvent['category']) ?? 'unknown',
    confidence: Number(raw.confidence ?? 0.5),
    accelerometerMagnitude: raw.accelerometerMagnitude != null ? Number(raw.accelerometerMagnitude) : undefined,
  };
}

/** Aggregate HR stream into min/max/avg for workout summary */
export function summarizeHeartRate(samples: WatchHeartRateReading[]): {
  avg: number;
  max: number;
  min: number;
  count: number;
} {
  if (samples.length === 0) return { avg: 0, max: 0, min: 0, count: 0 };
  const bpms = samples.map((s) => s.bpm);
  const sum = bpms.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / bpms.length),
    max: Math.max(...bpms),
    min: Math.min(...bpms),
    count: bpms.length,
  };
}

/** Infer workout activity from movement events */
export function inferActivityFromMovement(events: WatchMovementEvent[]): string {
  const lifting = events.filter((e) => e.category === 'lifting').length;
  const running = events.filter((e) => e.category === 'running').length;
  const walking = events.filter((e) => e.category === 'walking').length;
  if (lifting >= running && lifting >= walking && lifting > 0) return 'strength_training';
  if (running > walking) return 'running';
  if (walking > 0) return 'walking';
  return 'general_fitness';
}

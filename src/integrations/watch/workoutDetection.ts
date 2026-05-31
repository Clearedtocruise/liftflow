import type { WatchMovementEvent, WatchWorkoutDetectionState } from '@/integrations/watch/watchHealthArchitecture';

export type WorkoutDetectionConfig = {
  /** Minimum sustained magnitude to consider "active" */
  activeThreshold: number;
  /** Seconds of low movement before rest state */
  restTimeoutSec: number;
};

const DEFAULT_CONFIG: WorkoutDetectionConfig = {
  activeThreshold: 1.2,
  restTimeoutSec: 90,
};

export type WorkoutDetectionSnapshot = {
  state: WatchWorkoutDetectionState;
  lastMovement?: WatchMovementEvent;
  activeSince?: string;
  restSince?: string;
};

export function createWorkoutDetector(config: Partial<WorkoutDetectionConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let snapshot: WorkoutDetectionSnapshot = { state: 'idle' };

  return {
    get snapshot() {
      return snapshot;
    },
    processMovement(event: WatchMovementEvent, now = Date.now()): WorkoutDetectionSnapshot {
      const magnitude = event.accelerometerMagnitude ?? 0;
      const isActive = magnitude >= cfg.activeThreshold || event.category === 'lifting';

      if (snapshot.state === 'idle' && isActive) {
        snapshot = {
          state: 'warming_up',
          lastMovement: event,
          activeSince: new Date(now).toISOString(),
        };
        return snapshot;
      }

      if (snapshot.state === 'warming_up' && isActive) {
        snapshot = { ...snapshot, state: 'active', lastMovement: event };
        return snapshot;
      }

      if (snapshot.state === 'active') {
        if (isActive) {
          snapshot = { ...snapshot, lastMovement: event, restSince: undefined };
        } else {
          const restStart = snapshot.restSince ? new Date(snapshot.restSince).getTime() : now;
          if (!snapshot.restSince) {
            snapshot = { ...snapshot, state: 'resting', restSince: new Date(now).toISOString(), lastMovement: event };
          } else if (now - restStart > cfg.restTimeoutSec * 1000) {
            snapshot = { ...snapshot, state: 'cooldown' };
          }
        }
        return snapshot;
      }

      snapshot = { ...snapshot, lastMovement: event };
      return snapshot;
    },
    endWorkout(endedAt = new Date().toISOString()) {
      snapshot = { state: 'ended', lastMovement: snapshot.lastMovement, activeSince: snapshot.activeSince, restSince: endedAt };
      return snapshot;
    },
    reset() {
      snapshot = { state: 'idle' };
      return snapshot;
    },
  };
}

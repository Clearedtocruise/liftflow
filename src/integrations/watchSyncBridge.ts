import { Platform } from 'react-native';

import type { IntegrationAvailability, WatchSyncPayload } from './types';

/**
 * Apple Watch sync bridge — foundation for watchOS companion app.
 *
 * Architecture:
 * - iPhone app receives WatchConnectivity payloads via native module (future watchOS target)
 * - Payloads normalized to WatchSyncPayload and persisted via integrationService.syncWatchSession
 * - Heart rate, steps, calories, and active workout sessions flow through this bridge
 *
 * To complete: add watchOS target + WCSession native module, then wire receive handler here.
 */

type WatchConnectivityModule = {
  isSupported: () => boolean;
  isPaired: () => Promise<boolean>;
  isWatchAppInstalled: () => Promise<boolean>;
  sendMessage: (message: Record<string, unknown>) => Promise<void>;
};

function loadWatchConnectivity(): WatchConnectivityModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // Future: react-native-watch-connectivity or custom Expo module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-watch-connectivity');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export function getWatchAvailability(): IntegrationAvailability {
  if (Platform.OS !== 'ios') {
    return { available: false, reason: 'Apple Watch sync requires iOS.' };
  }
  if (!loadWatchConnectivity()) {
    return {
      available: false,
      reason: 'WatchConnectivity module not linked. watchOS companion app required for live sync.',
    };
  }
  return { available: true };
}

/** Normalize raw Watch payload into LiftFlow schema */
export function normalizeWatchPayload(raw: Record<string, unknown>): WatchSyncPayload {
  const heartRateSamples = Array.isArray(raw.heartRateSamples)
    ? (raw.heartRateSamples as { recordedAt: string; bpm: number }[])
    : [];

  return {
    workoutSessionId: raw.workoutSessionId as string | undefined,
    startedAt: String(raw.startedAt ?? new Date().toISOString()),
    endedAt: raw.endedAt ? String(raw.endedAt) : undefined,
    heartRateSamples,
    steps: typeof raw.steps === 'number' ? raw.steps : undefined,
    activeCalories: typeof raw.activeCalories === 'number' ? raw.activeCalories : undefined,
    distanceMeters: typeof raw.distanceMeters === 'number' ? raw.distanceMeters : undefined,
    motionSummary: (raw.motionSummary as Record<string, unknown>) ?? {},
  };
}

export async function requestWatchSync(): Promise<{ queued: boolean; error?: string }> {
  const wc = loadWatchConnectivity();
  if (!wc) {
    return { queued: false, error: getWatchAvailability().reason };
  }

  try {
    const paired = await wc.isPaired();
    if (!paired) return { queued: false, error: 'No Apple Watch paired' };

    await wc.sendMessage({ type: 'request_sync', timestamp: Date.now() });
    return { queued: true };
  } catch (error) {
    return { queued: false, error: error instanceof Error ? error.message : 'Watch sync request failed' };
  }
}

export function parseIncomingWatchMessage(message: Record<string, unknown>): WatchSyncPayload | null {
  if (message.type !== 'workout_sync' && message.type !== 'health_sync') return null;
  return normalizeWatchPayload(message);
}

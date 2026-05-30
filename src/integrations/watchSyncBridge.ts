import { Platform } from 'react-native';

import type { WatchMotionSample, WatchWorkoutAssistantState, WatchWorkoutMessage } from '@/integrations/watch';
import type { IntegrationAvailability, WatchSyncPayload } from './types';

/**
 * Apple Watch sync bridge — phone hosts workout assistant; watch sends motion + voice.
 *
 * Native: add watchOS target with CoreMotion → batch samples → WCSession messages.
 * Message types: workout_state, motion_batch, voice_command, rep_correction, confirm_reps, workout_sync
 */

type WatchConnectivityModule = {
  isSupported: () => boolean;
  isPaired: () => Promise<boolean>;
  isWatchAppInstalled: () => Promise<boolean>;
  sendMessage: (message: Record<string, unknown>) => Promise<void>;
  /** Optional: subscribe to incoming messages from watch */
  watchEvents?: { addListener: (cb: (event: { message: Record<string, unknown> }) => void) => { remove: () => void } };
};

function loadWatchConnectivity(): WatchConnectivityModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
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
  const wc = loadWatchConnectivity();
  if (!wc) {
    return {
      available: false,
      reason: 'WatchConnectivity not linked. Install watchOS companion + native module for live wrist tracking.',
    };
  }
  return { available: true };
}

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

export function parseWatchWorkoutMessage(raw: Record<string, unknown>): WatchWorkoutMessage | null {
  const type = raw.type as string | undefined;
  if (!type) return null;

  switch (type) {
    case 'workout_state':
      return { type: 'workout_state', state: raw.state as WatchWorkoutAssistantState };
    case 'motion_batch':
      return {
        type: 'motion_batch',
        samples: (raw.samples as WatchMotionSample[]) ?? [],
        workoutSessionId: String(raw.workoutSessionId ?? ''),
      };
    case 'voice_command':
      return {
        type: 'voice_command',
        transcript: String(raw.transcript ?? ''),
        workoutSessionId: raw.workoutSessionId as string | undefined,
      };
    case 'rep_correction':
      return {
        type: 'rep_correction',
        repCount: Number(raw.repCount ?? 0),
        workoutSessionId: String(raw.workoutSessionId ?? ''),
        workoutExerciseId: String(raw.workoutExerciseId ?? ''),
      };
    case 'confirm_reps':
      return {
        type: 'confirm_reps',
        workoutSessionId: String(raw.workoutSessionId ?? ''),
        workoutExerciseId: String(raw.workoutExerciseId ?? ''),
      };
    case 'workout_sync':
    case 'health_sync':
      return { type: 'workout_sync', ...raw };
    default:
      return null;
  }
}

export async function sendToWatch(message: WatchWorkoutMessage | Record<string, unknown>): Promise<{ sent: boolean; error?: string }> {
  const wc = loadWatchConnectivity();
  if (!wc) {
    return { sent: false, error: getWatchAvailability().reason };
  }

  try {
    const paired = await wc.isPaired();
    if (!paired) return { sent: false, error: 'No Apple Watch paired' };
    await wc.sendMessage(message as Record<string, unknown>);
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'Failed to send to Watch' };
  }
}

export async function pushWorkoutStateToWatch(state: WatchWorkoutAssistantState): Promise<{ sent: boolean; error?: string }> {
  return sendToWatch({ type: 'workout_state', state });
}

export async function requestWatchSync(): Promise<{ queued: boolean; error?: string }> {
  const result = await sendToWatch({ type: 'request_sync', timestamp: Date.now() });
  return { queued: result.sent, error: result.error };
}

export function parseIncomingWatchMessage(message: Record<string, unknown>): WatchSyncPayload | null {
  if (message.type === 'workout_sync' || message.type === 'health_sync') {
    return normalizeWatchPayload(message);
  }
  return null;
}

export function isWorkoutAssistantMessage(message: Record<string, unknown>): boolean {
  const t = message.type;
  return (
    t === 'motion_batch' ||
    t === 'voice_command' ||
    t === 'rep_correction' ||
    t === 'confirm_reps' ||
    t === 'workout_state'
  );
}

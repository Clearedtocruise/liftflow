import { Platform } from 'react-native';
import {
    getIsPaired,
    getIsWatchAppInstalled,
    sendMessage,
    updateApplicationContext,
    watchEvents,
} from 'react-native-watch-connectivity';

import { watchOfflineQueue } from '@/integrations/watchOfflineQueue';
import { watchCardioBridge } from '@/state/watchCardioBridge';

import type { WatchCardioState, WatchMotionSample, WatchWorkoutAssistantState, WatchWorkoutMessage } from '@/integrations/watch';
import {
    parseWatchHeartRate,
    parseWatchMovement,
    parseWatchWorkoutDetection,
    WATCH_MESSAGE_TYPES,
} from '@/integrations/watch/watchHealthArchitecture';
import type { IntegrationAvailability, WatchSyncPayload } from './types';

/**
 * Apple Watch sync bridge — phone hosts workout assistant; watch sends motion + voice.
 */

export function getWatchAvailability(): IntegrationAvailability {
  if (Platform.OS !== 'ios') {
    return { available: false, reason: 'Apple Watch sync requires iOS.' };
  }

  try {
    require('react-native-watch-connectivity');
    return { available: true };
  } catch {
    return {
      available: false,
      reason: 'WatchConnectivity not linked. Rebuild with the watch companion target.',
    };
  }
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
    case 'log_set':
      return {
        type: 'log_set',
        workoutSessionId: raw.workoutSessionId as string | undefined,
      };
    case 'start_workout':
      return {
        type: 'start_workout',
        workoutSessionId: raw.workoutSessionId as string | undefined,
      };
    case 'end_workout':
      return {
        type: 'end_workout',
        workoutSessionId: raw.workoutSessionId as string | undefined,
        activeCalories:
          typeof raw.activeCalories === 'number'
            ? raw.activeCalories
            : Number.isFinite(Number(raw.activeCalories))
              ? Number(raw.activeCalories)
              : undefined,
      };
    case 'cancel_workout':
      return {
        type: 'cancel_workout',
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
    case 'skip_rest':
      return { type: 'skip_rest', workoutSessionId: raw.workoutSessionId as string | undefined };
    case 'set_weight':
      return {
        type: 'set_weight',
        weightLbs: Number(raw.weightLbs ?? 0),
        workoutSessionId: raw.workoutSessionId as string | undefined,
      };
    case 'next_set':
      return { type: 'next_set', workoutSessionId: raw.workoutSessionId as string | undefined };
    case 'workout_sync':
    case 'health_sync':
      return { type: 'workout_sync', ...raw };
    case 'cardio_state':
      return { type: 'cardio_state', state: raw.state as WatchCardioState };
    case 'heart_rate_sample':
      return {
        type: 'heart_rate_sample',
        bpm: Number(raw.bpm ?? 0),
        recordedAt: String(raw.recordedAt ?? new Date().toISOString()),
      };
    case 'active_calories':
      return {
        type: 'active_calories',
        activeCalories: Number(raw.activeCalories ?? 0),
        workoutSessionId: raw.workoutSessionId as string | undefined,
      };
    default:
      return null;
  }
}

async function sendMessageAsync(message: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    sendMessage(
      message,
      () => resolve(),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

export async function sendToWatch(
  message: WatchWorkoutMessage | Record<string, unknown>,
): Promise<{ sent: boolean; error?: string }> {
  const isWorkoutState = (message as Record<string, unknown>).type === 'workout_state';
  const isCardioState = (message as Record<string, unknown>).type === 'cardio_state';

  try {
    require('react-native-watch-connectivity');
  } catch {
    await watchOfflineQueue.enqueue(message as Record<string, unknown>);
    return { sent: false, error: getWatchAvailability().reason };
  }

  try {
    if (isWorkoutState || isCardioState) {
      updateApplicationContext(message as Record<string, unknown>);
    }

    const paired = await getIsPaired();
    if (!paired) {
      await watchOfflineQueue.enqueue(message as Record<string, unknown>);
      return { sent: false, error: 'No Apple Watch paired' };
    }

    const installed = await getIsWatchAppInstalled();
    if (!installed) {
      await watchOfflineQueue.enqueue(message as Record<string, unknown>);
      return { sent: false, error: 'ONE MORE Watch app not installed — open Watch app on iPhone to install' };
    }

    await sendMessageAsync(message as Record<string, unknown>);

    return { sent: true };
  } catch (error) {
    await watchOfflineQueue.enqueue(message as Record<string, unknown>);
    return { sent: false, error: error instanceof Error ? error.message : 'Failed to send to Watch' };
  }
}

export async function flushWatchOutboundQueue(): Promise<number> {
  try {
    require('react-native-watch-connectivity');
  } catch {
    return 0;
  }

  const queued = await watchOfflineQueue.list();
  let sent = 0;
  for (const item of queued) {
    try {
      await sendMessageAsync(item.message);
      await watchOfflineQueue.remove(item.id);
      sent += 1;
    } catch {
      await watchOfflineQueue.markAttempt(item.id);
      break;
    }
  }
  return sent;
}

export function subscribeToWatchMessages(
  handler: (
    message: Record<string, unknown>,
  ) => Promise<WatchInboundHandlerResult | void> | WatchInboundHandlerResult | void,
): () => void {
  try {
    require('react-native-watch-connectivity');
  } catch {
    return () => undefined;
  }

  const dispatch = async (
    payload: Record<string, unknown> | null | undefined,
    reply?: ((resp: Record<string, unknown>) => void) | null,
  ) => {
    if (!payload || typeof payload !== 'object') return;
    if (!isInboundWatchCommand(payload)) return;

    try {
      const result = await handler(payload);
      if (result?.reply) {
        reply?.(result.reply);
      } else {
        reply?.({ received: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Watch command failed';
      console.warn('[watchSyncBridge] inbound command failed', message);
      reply?.({ type: 'error', message });
    }
  };

  const unsubMessage = watchEvents.addListener('message', (payload, reply) => {
    void dispatch(payload as Record<string, unknown>, reply);
  });

  const unsubContext = watchEvents.addListener('application-context', (payload) => {
    void dispatch(payload as Record<string, unknown>);
  });

  const unsubUserInfo = watchEvents.addListener('user-info', (items) => {
    for (const item of items) {
      void dispatch(item as Record<string, unknown>);
    }
  });

  return () => {
    unsubMessage();
    unsubContext();
    unsubUserInfo();
  };
}

export async function pushRestCompleteToWatch(): Promise<{ sent: boolean; error?: string }> {
  return sendToWatch({ type: 'rest_complete', timestamp: Date.now() });
}

export async function pushCardioStateToWatch(
  _state: WatchCardioState | null,
  _options?: { presentWorkout?: boolean },
): Promise<{ sent: boolean; error?: string }> {
  // Extra/cardio Watch companion removed — Apple Fitness owns activity tracking.
  return { sent: false, error: 'Cardio Watch mode disabled' };
}

let watchSyncGeneration = 0;

/** Bump and attach a monotonic sync generation so the Watch can drop stale packets. */
export function nextWatchSyncGeneration(): number {
  watchSyncGeneration += 1;
  return watchSyncGeneration;
}

export async function pushWorkoutStateToWatch(
  state: WatchWorkoutAssistantState,
  options?: { presentWorkout?: boolean; force?: boolean },
): Promise<{ sent: boolean; error?: string }> {
  if (!options?.force && watchCardioBridge.isWatchOwnedByCardio()) {
    return { sent: false, error: 'Watch is showing cardio' };
  }

  const generation = state.syncGeneration ?? nextWatchSyncGeneration();
  const stateWithGeneration: WatchWorkoutAssistantState = {
    ...state,
    syncGeneration: generation,
  };

  const payload: Record<string, unknown> = {
    type: 'workout_state',
    state: serializeWatchStateForNative(stateWithGeneration),
  };
  if (options?.presentWorkout) {
    payload.presentWorkout = true;
  }
  const result = await sendToWatch(payload);

  if (state.sessionEnded) {
    await sendToWatch({
      type: 'workout_ended',
      message: state.lastSpokenResponse ?? 'Workout ended',
    });
  }

  return result;
}

export async function pushWorkoutEndedToWatch(message = 'Workout ended'): Promise<{ sent: boolean; error?: string }> {
  return sendToWatch({ type: 'workout_ended', message });
}

export async function requestWatchSync(): Promise<{ queued: boolean; error?: string }> {
  const result = await sendToWatch({ type: 'request_sync', timestamp: Date.now() });
  return { queued: result.sent, error: result.error };
}

export function parseIncomingWatchMessage(message: Record<string, unknown>): WatchSyncPayload | null {
  if (message.type === WATCH_MESSAGE_TYPES.WORKOUT_SYNC || message.type === 'health_sync') {
    return normalizeWatchPayload(message);
  }
  return null;
}

export function parseWatchHealthMessage(message: Record<string, unknown>) {
  return {
    workoutDetection: parseWatchWorkoutDetection(message),
    heartRate: parseWatchHeartRate(message),
    movement: parseWatchMovement(message),
  };
}

export function isWorkoutAssistantMessage(message: Record<string, unknown>): boolean {
  const t = message.type;
  return (
    t === 'motion_batch' ||
    t === 'voice_command' ||
    t === 'log_set' ||
    t === 'rep_correction' ||
    t === 'confirm_reps' ||
    t === 'skip_rest' ||
    t === 'set_weight' ||
    t === 'next_set' ||
    t === 'start_workout' ||
    t === 'cancel_workout' ||
    t === 'end_workout' ||
    t === 'workout_state'
  );
}

/** Watch → phone commands (not phone → watch state echoes). */
export function isInboundWatchCommand(message: Record<string, unknown>): boolean {
  const type = message.type;
  if (typeof type !== 'string' || type === 'workout_state' || type === 'cardio_state') return false;
  if (type === 'request_sync' || type === 'heart_rate_sample') return true;
  return isWorkoutAssistantMessage(message);
}

export function serializeWatchStateForNative(state: WatchWorkoutAssistantState): WatchWorkoutAssistantState {
  return JSON.parse(JSON.stringify(state)) as WatchWorkoutAssistantState;
}

export type WatchInboundHandlerResult = {
  reply?: Record<string, unknown>;
};

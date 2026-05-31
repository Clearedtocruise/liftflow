import type { WatchWorkoutAssistantState } from '@/integrations/watch';
import {
    flushWatchOutboundQueue,
    pushWorkoutStateToWatch,
    subscribeToWatchMessages,
} from '@/integrations/watchSyncBridge';
import { integrationService } from '@/services/integrationService';
import { recoveryService } from '@/services/recoveryService';
import { watchWorkoutService } from '@/services/watchWorkoutService';
import { workoutRecommendationService } from '@/services/workoutRecommendationService';
import type { WorkoutSession } from '@/types';

export const watchCompanionService = {
  async enrichState(userId: string, state: WatchWorkoutAssistantState): Promise<WatchWorkoutAssistantState> {
    const [recovery, daily] = await Promise.all([
      recoveryService.getIntelligence(userId),
      workoutRecommendationService.getDaily(userId),
    ]);

    let progressionLine: string | undefined;
    if (state.activeSet) {
      const suggested = await watchWorkoutService.suggestProgressionLine(
        userId,
        state.activeSet.exerciseId,
        state.activeSet.targetReps,
      );
      progressionLine = suggested;
    }

    return {
      ...state,
      recoveryScore: recovery.success ? recovery.data.recoveryScore : undefined,
      recoveryLabel: recovery.success ? recovery.data.recoveryStatusLabel : undefined,
      workoutRecommendation: daily.success
        ? daily.data.today.voiceLine ?? daily.data.today.sessionLabel ?? undefined
        : undefined,
      progressionLine,
      updatedAt: new Date().toISOString(),
    };
  },

  async pushPhoneWorkoutState(
    userId: string,
    params: {
      session: WorkoutSession | null;
      restSecondsRemaining: number | null;
    },
  ): Promise<void> {
    if (!params.session) {
      const cleared = watchWorkoutService.getState(userId);
      const enriched = await this.enrichState(userId, { ...cleared, activeSet: null });
      watchWorkoutService.loadState(userId, enriched);
      await pushWorkoutStateToWatch(enriched);
      return;
    }

    const sync = await watchWorkoutService.syncActiveSession(userId);
    if (!sync.success) return;

    let state = sync.data;
    if (params.restSecondsRemaining != null && state.activeSet) {
      state = watchWorkoutService.updateRestTimer(userId, params.restSecondsRemaining);
    }

    const enriched = await this.enrichState(userId, state);
    watchWorkoutService.loadState(userId, enriched);
    await pushWorkoutStateToWatch(enriched);
  },

  async handleInboundMessage(userId: string, message: Record<string, unknown>) {
    return integrationService.handleWatchMessage(message, userId);
  },

  startInboundListener(userId: string): () => void {
    return subscribeToWatchMessages(async (message) => {
      await this.handleInboundMessage(userId, message);
    });
  },

  async flushOfflineQueue(): Promise<number> {
    return flushWatchOutboundQueue();
  },
};

import type { WatchWorkoutAssistantState } from '@/integrations/watch';
import {
    flushWatchOutboundQueue,
    pushWorkoutStateToWatch,
    subscribeToWatchMessages,
} from '@/integrations/watchSyncBridge';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getWeekRange } from '@/lib/weekPlan';
import { integrationService } from '@/services/integrationService';
import { recoveryService } from '@/services/recoveryService';
import { trainingService } from '@/services/trainingService';
import { watchWorkoutService } from '@/services/watchWorkoutService';
import { workoutRecommendationService } from '@/services/workoutRecommendationService';
import { workoutService } from '@/services/workoutService';
import { supabase } from '@/supabase/client';
import type { WorkoutSession } from '@/types';
import type { ServiceResult } from '@/types/common';

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

  async startTodaysWorkoutFromWatch(userId: string): Promise<ServiceResult<WatchWorkoutAssistantState>> {
    try {
      const active = await workoutService.getActiveSession(userId);
      if (active.success && active.data) {
        const sync = await watchWorkoutService.syncActiveSession(userId);
        if (!sync.success) return fail(sync.error);
        const enriched = await this.enrichState(userId, sync.data);
        watchWorkoutService.loadState(userId, enriched);
        return ok(enriched);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone, primary_gym_name, training_location')
        .eq('id', userId)
        .maybeSingle();

      const tz = profile?.timezone ?? null;
      const today = localDateString(new Date(), tz);
      const { from, to } = getWeekRange(new Date(), tz);
      const planned = await trainingService.getPlannedWorkouts(userId, from, to, tz);
      if (!planned.success) return fail(planned.error);

      const activeDay = resolveActiveTrainingDay(planned.data, { date: today, timeZone: tz });
      if (!activeDay.workout) {
        return fail('No workout scheduled for today.');
      }

      const started = await workoutService.startSessionFromPlanned(userId, activeDay.workout.id, {
        name: activeDay.workout.name,
        gymName: profile?.primary_gym_name ?? undefined,
        trainingLocation: profile?.training_location ?? undefined,
      });

      if (!started.success) return fail(started.error);

      const sync = await watchWorkoutService.syncActiveSession(userId);
      if (!sync.success) return fail(sync.error);

      const enriched = await this.enrichState(userId, sync.data);
      watchWorkoutService.loadState(userId, enriched);
      watchWorkoutService.speak('Workout started.');
      return ok(enriched);
    } catch (e) {
      return fromError(e);
    }
  },

  async handleInboundMessage(userId: string, message: Record<string, unknown>) {
    if (message.type === 'start_workout') {
      const started = await this.startTodaysWorkoutFromWatch(userId);
      const sessionResult = await workoutService.getActiveSession(userId);
      await this.pushPhoneWorkoutState(userId, {
        session: sessionResult.success ? sessionResult.data : null,
        restSecondsRemaining: null,
      });
      return started;
    }

    const result = await integrationService.handleWatchMessage(message, userId);

    const sessionResult = await workoutService.getActiveSession(userId);
    await this.pushPhoneWorkoutState(userId, {
      session: sessionResult.success ? sessionResult.data : null,
      restSecondsRemaining: null,
    });

    return result;
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

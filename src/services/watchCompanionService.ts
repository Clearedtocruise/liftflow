import type { WatchWorkoutAssistantState } from '@/integrations/watch';
import {
    flushWatchOutboundQueue,
    pushWorkoutStateToWatch,
    subscribeToWatchMessages,
    type WatchInboundHandlerResult,
} from '@/integrations/watchSyncBridge';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getWeekRange, isConditioningWorkout } from '@/lib/weekPlan';
import { exercisesForSessionStart } from '@/lib/workoutPlan';
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
    const [recovery, daily, idlePreview] = await Promise.all([
      recoveryService.getIntelligence(userId),
      workoutRecommendationService.getDaily(userId),
      state.activeSet ? Promise.resolve(undefined) : this.buildIdleWorkoutPreview(userId),
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

    const dailyLine = daily.success
      ? daily.data.today.voiceLine ?? daily.data.today.sessionLabel ?? undefined
      : undefined;

    return {
      ...state,
      recoveryScore: recovery.success ? recovery.data.recoveryScore : undefined,
      recoveryLabel: recovery.success ? recovery.data.recoveryStatusLabel : undefined,
      workoutRecommendation: state.activeSet
        ? dailyLine
        : idlePreview ?? dailyLine,
      progressionLine,
      updatedAt: new Date().toISOString(),
    };
  },

  async buildIdleWorkoutPreview(userId: string): Promise<string | undefined> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();

    const tz = profile?.timezone ?? null;
    const today = localDateString(new Date(), tz);
    const { from, to } = getWeekRange(new Date(), tz);
    const planned = await trainingService.getPlannedWorkouts(userId, from, to, tz);
    if (!planned.success) return undefined;

    const activeDay = resolveActiveTrainingDay(planned.data, { date: today, timeZone: tz });
    const workout = activeDay.workout;
    if (!workout) return undefined;

    const exercises = workout.metadata?.exercises ?? [];
    const first = exercises[0];
    if (!first) return workout.name;

    const reps = first.reps ? ` · ${first.reps} reps` : '';
    const sets = first.sets ? `${first.sets}×` : '';
    return `${workout.name} · ${first.name} ${sets}${reps}`.replace(/\s+/g, ' ').trim();
  },

  async pushPhoneWorkoutState(
    userId: string,
    params: {
      session: WorkoutSession | null;
      restSecondsRemaining: number | null;
      activeExerciseIndex?: number;
    },
  ): Promise<void> {
    let session = params.session;
    if (!session) {
      const active = await workoutService.getActiveSession(userId);
      if (active.success && active.data) {
        session = active.data;
      }
    }

    if (!session) {
      const cleared = watchWorkoutService.getState(userId);
      const enriched = await this.enrichState(userId, { ...cleared, activeSet: null });
      watchWorkoutService.loadState(userId, enriched);
      await pushWorkoutStateToWatch(enriched);
      return;
    }

    const sync = await watchWorkoutService.syncActiveSession(userId, session, {
      exerciseIndex: params.activeExerciseIndex ?? 0,
    });
    if (!sync.success) {
      const feedback = await this.buildFeedbackState(userId, sync.error ?? 'Could not sync workout to Watch.');
      await pushWorkoutStateToWatch(feedback);
      return;
    }

    let state = sync.data;
    if (params.restSecondsRemaining != null && state.activeSet) {
      state = watchWorkoutService.updateRestTimer(userId, params.restSecondsRemaining);
    }

    const enriched = await this.enrichState(userId, state);
    watchWorkoutService.loadState(userId, enriched);
    await pushWorkoutStateToWatch(enriched);
  },

  async buildFeedbackState(
    userId: string,
    message: string,
  ): Promise<WatchWorkoutAssistantState> {
    const base = watchWorkoutService.getState(userId);
    const enriched = await this.enrichState(userId, {
      ...base,
      lastSpokenResponse: message,
      updatedAt: new Date().toISOString(),
    });
    watchWorkoutService.loadState(userId, enriched);
    return enriched;
  },

  async replyWithCurrentState(userId: string): Promise<WatchInboundHandlerResult> {
    const state = watchWorkoutService.getState(userId);
    const enriched = await this.enrichState(userId, state);
    watchWorkoutService.loadState(userId, enriched);
    await pushWorkoutStateToWatch(enriched);
    return { reply: { type: 'workout_state', state: enriched } };
  },

  async startTodaysWorkoutFromWatch(userId: string): Promise<ServiceResult<WatchWorkoutAssistantState>> {
    try {
      const active = await workoutService.getActiveSession(userId);
      if (active.success && active.data) {
        const sync = await watchWorkoutService.syncActiveSession(userId, active.data);
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

      if (isConditioningWorkout(activeDay.workout)) {
        return fail('Today is a cardio session. Open ONE MORE on your iPhone to log it.');
      }

      const exercisePlan = exercisesForSessionStart(activeDay.workout, false);
      if (exercisePlan.length === 0) {
        return fail('No exercises found for today. Refresh your plan on iPhone.');
      }

      const started = await workoutService.startSessionFromPlanned(userId, activeDay.workout.id, {
        name: activeDay.workout.name,
        gymName: profile?.primary_gym_name ?? undefined,
        trainingLocation: profile?.training_location ?? undefined,
        exercisePlan,
      });

      if (!started.success) return fail(started.error);

      const sync = await watchWorkoutService.syncActiveSession(userId, started.data);
      if (!sync.success) return fail(sync.error);

      const enriched = await this.enrichState(userId, sync.data);
      watchWorkoutService.loadState(userId, enriched);
      watchWorkoutService.speak('Workout started.');
      return ok(enriched);
    } catch (e) {
      return fromError(e);
    }
  },

  async handleInboundMessage(
    userId: string,
    message: Record<string, unknown>,
  ): Promise<WatchInboundHandlerResult> {
    if (message.type === 'request_sync') {
      const sessionResult = await workoutService.getActiveSession(userId);
      await this.pushPhoneWorkoutState(userId, {
        session: sessionResult.success ? sessionResult.data : null,
        restSecondsRemaining: null,
      });
      return this.replyWithCurrentState(userId);
    }

    if (message.type === 'start_workout') {
      const started = await this.startTodaysWorkoutFromWatch(userId);
      const sessionResult = await workoutService.getActiveSession(userId);
      await this.pushPhoneWorkoutState(userId, {
        session: sessionResult.success ? sessionResult.data : null,
        restSecondsRemaining: null,
      });

      if (started.success) {
        return { reply: { type: 'workout_state', state: started.data } };
      }

      const feedback = await this.buildFeedbackState(userId, started.error ?? 'Could not start workout.');
      await pushWorkoutStateToWatch(feedback);
      return { reply: { type: 'workout_state', state: feedback } };
    }

    const result = await integrationService.handleWatchMessage(message, userId);

    const sessionResult = await workoutService.getActiveSession(userId);
    await this.pushPhoneWorkoutState(userId, {
      session: sessionResult.success ? sessionResult.data : null,
      restSecondsRemaining: null,
    });

    if (result && typeof result === 'object' && 'success' in result && result.success === false) {
      const errorMessage =
        'error' in result && typeof result.error === 'string' ? result.error : 'Command failed.';
      const feedback = await this.buildFeedbackState(userId, errorMessage);
      await pushWorkoutStateToWatch(feedback);
      return { reply: { type: 'workout_state', state: feedback } };
    }

    return this.replyWithCurrentState(userId);
  },

  startInboundListener(userId: string, onSessionChange?: () => void): () => void {
    return subscribeToWatchMessages(async (message) => {
      const result = await this.handleInboundMessage(userId, message);
      onSessionChange?.();
      return result;
    });
  },

  async flushOfflineQueue(): Promise<number> {
    return flushWatchOutboundQueue();
  },
};

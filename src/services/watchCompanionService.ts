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
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';
import { supabase } from '@/supabase/client';
import type { WorkoutSession } from '@/types';
import type { ServiceResult } from '@/types/common';

/** Phone-side commands that must not trigger syncActiveSession + enrichState on the Watch. */
const LIGHTWEIGHT_INBOUND = new Set(['skip_rest', 'set_weight', 'voice_command', 'log_set']);

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
      /** When true, never re-fetch an active session from the database. */
      forceClear?: boolean;
      /** Wake the Watch app and show the active workout UI. */
      presentWorkout?: boolean;
    },
  ): Promise<void> {
    const exerciseIndex = params.activeExerciseIndex ?? watchPhoneBridge.getExerciseIndex();
    const restSeconds = params.restSecondsRemaining ?? watchPhoneBridge.getRestSecondsRemaining();

    const session = params.forceClear ? null : params.session;

    const presentWorkout = params.presentWorkout === true;

    if (!session) {
      const cleared = watchWorkoutService.getState(userId);
      const enriched = await this.enrichState(userId, { ...cleared, activeSet: null });
      watchWorkoutService.loadState(userId, enriched);
      await pushWorkoutStateToWatch(enriched, { presentWorkout });
      return;
    }

    let sync = await watchWorkoutService.syncActiveSession(userId, session, {
      exerciseIndex,
    });
    if (!sync.success && sync.error?.includes('no exercises')) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      sync = await watchWorkoutService.syncActiveSession(userId, session, {
        exerciseIndex,
      });
    }
    if (!sync.success) {
      const feedback = await this.buildFeedbackState(userId, sync.error ?? 'Could not sync workout to Watch.');
      await pushWorkoutStateToWatch(feedback, { presentWorkout });
      return;
    }

    let state = sync.data;
    if (restSeconds != null && state.activeSet) {
      state = watchWorkoutService.updateRestTimer(userId, restSeconds);
    }

    state = this.applyDisplayContext(state, watchPhoneBridge.getDisplayContext());

    const enriched = await this.enrichState(userId, state);
    watchWorkoutService.loadState(userId, enriched);
    await pushWorkoutStateToWatch(enriched, { presentWorkout });
  },

  /** Push active workout to Watch immediately after phone start — opens workout UI on Watch when reachable. */
  async notifyWatchWorkoutStarted(userId: string, session: WorkoutSession): Promise<void> {
    await this.pushPhoneWorkoutState(userId, {
      session,
      restSecondsRemaining: null,
      activeExerciseIndex: 0,
      presentWorkout: true,
    });
  },

  /** Rest tick only — avoids re-syncing exercise/set state every second. */
  async pushRestTimerOnly(userId: string, restSecondsRemaining: number | null): Promise<void> {
    const assistantState = watchWorkoutService.getState(userId);
    if (!assistantState.activeSet) return;

    const restSeconds = restSecondsRemaining ?? 0;
    const state = watchWorkoutService.updateRestTimer(userId, restSeconds);
    const display = watchPhoneBridge.getDisplayContext();
    const patched = this.applyDisplayContext(state, display);
    watchWorkoutService.loadState(userId, patched);
    await pushWorkoutStateToWatch(patched);
  },

  applyDisplayContext(
    state: WatchWorkoutAssistantState,
    display: ReturnType<typeof watchPhoneBridge.getDisplayContext>,
  ): WatchWorkoutAssistantState {
    if (!display?.statusLine && !display?.stationLabel && display?.draftReps == null) {
      return state;
    }
    const set = state.activeSet;
    if (!set) return state;

    const draftReps = display?.draftReps ?? watchPhoneBridge.getPendingWatchReps();
    return {
      ...state,
      activeSet: {
        ...set,
        currentRepCount: draftReps ?? set.currentRepCount,
        stationLabel: display?.stationLabel,
        statusLine: display?.statusLine,
        supersetHint: display?.supersetHint,
      },
      updatedAt: new Date().toISOString(),
    };
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
        restSecondsRemaining: watchPhoneBridge.getRestSecondsRemaining(),
        activeExerciseIndex: watchPhoneBridge.getExerciseIndex(),
      });
      return this.replyWithCurrentState(userId);
    }

    if (message.type === 'cancel_workout') {
      const bridgeResult = await watchPhoneBridge.cancelWorkout();
      if (!bridgeResult.ok) {
        const active = await workoutService.getActiveSession(userId);
        if (active.success && active.data) {
          await workoutService.cancelSession(active.data.id);
        }
      }
      await this.pushPhoneWorkoutState(userId, {
        session: null,
        restSecondsRemaining: null,
        forceClear: true,
      });
      const cleared = watchWorkoutService.getState(userId);
      const enriched = await this.enrichState(userId, { ...cleared, activeSet: null });
      watchWorkoutService.loadState(userId, enriched);
      return {
        reply: {
          type: 'workout_state',
          state: { ...enriched, lastSpokenResponse: 'Workout cancelled.' },
        },
      };
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

    const messageType = typeof message.type === 'string' ? message.type : '';

    if (result && typeof result === 'object' && 'success' in result && result.success === false) {
      const errorMessage =
        'error' in result && typeof result.error === 'string' ? result.error : 'Command failed.';
      const feedback = await this.buildFeedbackState(userId, errorMessage);
      await pushWorkoutStateToWatch(feedback);
      return { reply: { type: 'workout_state', state: feedback } };
    }

    if (LIGHTWEIGHT_INBOUND.has(messageType)) {
      const state = this.applyDisplayContext(
        watchWorkoutService.getState(userId),
        watchPhoneBridge.getDisplayContext(),
      );
      watchWorkoutService.loadState(userId, state);
      await pushWorkoutStateToWatch(state);
      return { reply: { type: 'workout_state', state } };
    }

    const restAfterCommand = watchPhoneBridge.getRestSecondsRemaining();
    const sessionResult = await workoutService.getActiveSession(userId);
    await this.pushPhoneWorkoutState(userId, {
      session: sessionResult.success ? sessionResult.data : null,
      restSecondsRemaining: restAfterCommand,
      activeExerciseIndex: watchPhoneBridge.getExerciseIndex(),
    });

    return this.replyWithCurrentState(userId);
  },

  startInboundListener(
    userId: string,
    onSessionChange?: (message: Record<string, unknown>) => void,
  ): () => void {
    return subscribeToWatchMessages(async (message) => {
      const result = await this.handleInboundMessage(userId, message);
      onSessionChange?.(message);
      return result;
    });
  },

  async flushOfflineQueue(): Promise<number> {
    return flushWatchOutboundQueue();
  },
};

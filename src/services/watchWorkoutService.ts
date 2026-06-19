import * as Speech from 'expo-speech';

import {
    WatchWorkoutAssistant,
    resolveExerciseProfile,
    synthesizeRepMotionBatch,
    type WatchMotionSample,
    type WatchWorkoutAssistantState,
    type WatchWorkoutMessage,
} from '@/integrations/watch';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { workoutService } from '@/services/workoutService';
import { supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

const assistants = new Map<string, WatchWorkoutAssistant>();

function getAssistant(userId: string): WatchWorkoutAssistant {
  let a = assistants.get(userId);
  if (!a) {
    a = new WatchWorkoutAssistant(userId);
    assistants.set(userId, a);
  }
  return a;
}

async function getLastPerformance(
  userId: string,
  exerciseId: string,
): Promise<{ weightLbs?: number; reps?: number }> {
  const { data } = await supabase
    .from('workout_sets')
    .select('weight, reps, logged_at, workout_exercises!inner(exercise_id, workout_sessions!inner(user_id, status))')
    .eq('workout_exercises.exercise_id', exerciseId)
    .eq('workout_exercises.workout_sessions.user_id', userId)
    .eq('workout_exercises.workout_sessions.status', 'completed')
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return {};
  return { weightLbs: Number(data.weight ?? 0) || undefined, reps: Number(data.reps ?? 0) || undefined };
}

async function suggestWeight(
  userId: string,
  exerciseId: string,
  targetReps: number,
): Promise<{ weightLbs?: number; repRange: string }> {
  const last = await getLastPerformance(userId, exerciseId);
  if (last.weightLbs && last.reps) {
    const bump = last.reps >= targetReps ? 5 : 0;
    return { weightLbs: last.weightLbs + bump, repRange: `${targetReps}` };
  }
  return { repRange: `${targetReps}` };
}

async function persistRepEvent(
  userId: string,
  workoutSetId: string | undefined,
  detectedReps: number,
  confidence: number,
  confirmedReps?: number,
  isConfirmed = false,
): Promise<void> {
  await supabase.from('rep_count_events').insert({
    user_id: userId,
    workout_set_id: workoutSetId ?? null,
    detected_reps: detectedReps,
    confidence,
    confirmed_reps: confirmedReps ?? null,
    is_confirmed: isConfirmed,
  });
}

async function persistMotionSamples(
  userId: string,
  sessionId: string,
  samples: WatchMotionSample[],
  movementCategory?: string,
): Promise<void> {
  if (samples.length === 0) return;
  const rows = samples.slice(-30).map((s) => ({
    user_id: userId,
    session_id: sessionId,
    recorded_at: new Date(s.recordedAt).toISOString(),
    accelerometer: s.accelerometer,
    gyroscope: s.gyroscope ?? null,
    movement_category: movementCategory ?? null,
    metadata: { source: 'apple_watch' },
  }));
  await supabase.from('motion_samples').insert(rows);
}

export const watchWorkoutService = {
  getState(userId: string): WatchWorkoutAssistantState {
    return getAssistant(userId).getState();
  },

  loadState(userId: string, state: WatchWorkoutAssistantState): void {
    getAssistant(userId).loadState(state);
  },

  updateRestTimer(userId: string, restSecondsRemaining: number): WatchWorkoutAssistantState {
    const assistant = getAssistant(userId);
    const set = assistant.getState().activeSet;
    if (!set) return assistant.getState();
    assistant.loadState({
      ...assistant.getState(),
      activeSet: {
        ...set,
        phase: restSecondsRemaining > 0 ? 'rest' : 'active_set',
        restSecondsRemaining: restSecondsRemaining > 0 ? restSecondsRemaining : undefined,
      },
      updatedAt: new Date().toISOString(),
    });
    return assistant.getState();
  },

  async suggestProgressionLine(
    userId: string,
    exerciseId: string,
    targetReps: number,
  ): Promise<string | undefined> {
    const suggested = await suggestWeight(userId, exerciseId, targetReps);
    if (suggested.weightLbs) {
      return `Try ${suggested.weightLbs} lb for ${suggested.repRange} reps.`;
    }
    return undefined;
  },

  async syncActiveSession(userId: string): Promise<ServiceResult<WatchWorkoutAssistantState>> {
    try {
      const sessionResult = await workoutService.getActiveSession(userId);
      if (!sessionResult.success) return fail(sessionResult.error);
      if (!sessionResult.data) {
        getAssistant(userId).clearSet();
        return ok(getAssistant(userId).getState());
      }

      const session = sessionResult.data;
      const activeExercise = session.exercises.find((e) => e.isActive) ?? session.exercises[0];
      if (!activeExercise?.exercise) {
        return ok(getAssistant(userId).getState());
      }

      const setNumber = (activeExercise.sets.length ?? 0) + 1;
      const profile = resolveExerciseProfile(activeExercise.exercise.name);
      const last = await getLastPerformance(userId, activeExercise.exerciseId);
      const suggested = await suggestWeight(userId, activeExercise.exerciseId, profile?.targetRepsDefault ?? 8);

      const state = getAssistant(userId).startSet({
        userId,
        workoutSessionId: session.id,
        workoutExerciseId: activeExercise.id,
        exerciseId: activeExercise.exerciseId,
        exerciseName: activeExercise.exercise.name,
        setNumber,
        targetSets: profile?.targetSetsDefault,
        targetReps: profile?.targetRepsDefault,
        weightLbs: suggested.weightLbs ?? last.weightLbs,
      });

      return ok(state);
    } catch (e) {
      return fromError(e);
    }
  },

  async processMotion(
    userId: string,
    samples: WatchMotionSample[],
  ): Promise<
    ServiceResult<{
      state: WatchWorkoutAssistantState;
      detectedReps: number;
      confidence: number;
      needsConfirmation: boolean;
      spokenPrompt?: string;
    }>
  > {
    try {
      const assistant = getAssistant(userId);
      const set = assistant.getState().activeSet;
      if (!set) return fail('No active set — open a workout on your phone first.');

      const result = assistant.processMotionBatch(samples);
      const profile = resolveExerciseProfile(set.exerciseName);
      await persistMotionSamples(userId, set.workoutSessionId, samples, profile?.movementCategory);

      if (result.needsConfirmation && result.detectedReps > 0) {
        await persistRepEvent(userId, undefined, result.detectedReps, result.confidence);
      }

      let spokenPrompt: string | undefined;
      if (result.needsConfirmation) {
        spokenPrompt = `I counted ${result.detectedReps} reps with low confidence. Say "correct to rep" or confirm on screen.`;
      } else if (result.detectedReps > set.currentRepCount) {
        spokenPrompt = `Rep ${result.detectedReps}.`;
      }

      return ok({
        state: result.state,
        detectedReps: result.detectedReps,
        confidence: result.confidence,
        needsConfirmation: result.needsConfirmation,
        spokenPrompt,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async correctReps(userId: string, repCount: number): Promise<ServiceResult<WatchWorkoutAssistantState>> {
    try {
      const state = getAssistant(userId).correctRepCount(repCount);
      const set = state.activeSet;
      if (set) {
        await persistRepEvent(userId, undefined, repCount, 1, repCount, true);
      }
      return ok(state);
    } catch (e) {
      return fromError(e);
    }
  },

  async confirmReps(userId: string): Promise<ServiceResult<WatchWorkoutAssistantState>> {
    try {
      const assistant = getAssistant(userId);
      const set = assistant.getState().activeSet;
      if (set) {
        await persistRepEvent(userId, undefined, set.currentRepCount, set.motionConfidence, set.currentRepCount, true);
      }
      return ok(assistant.confirmReps());
    } catch (e) {
      return fromError(e);
    }
  },

  async handleVoice(userId: string, transcript: string): Promise<
    ServiceResult<{
      state: WatchWorkoutAssistantState;
      spokenResponse: string;
      shouldLogSet?: boolean;
    }>
  > {
    try {
      const assistant = getAssistant(userId);
      const set = assistant.getState().activeSet;
      let voiceCtx = {};
      if (set) {
        const last = await getLastPerformance(userId, set.exerciseId);
        const suggested = await suggestWeight(userId, set.exerciseId, set.targetReps);
        voiceCtx = {
          lastWeightLbs: last.weightLbs,
          lastReps: last.reps,
          suggestedWeightLbs: suggested.weightLbs,
          suggestedReps: suggested.repRange,
        };
      }

      const enriched = assistant.getState();
      const result = assistant.handleVoice(transcript, {
        ...voiceCtx,
        recoveryScore: enriched.recoveryScore,
        recoveryLabel: enriched.recoveryLabel,
        workoutRecommendation: enriched.workoutRecommendation,
        progressionLine: enriched.progressionLine,
      });

      if (result.intent === 'next_set' || result.intent === 'skip_rest') {
        assistant.advanceToNextSet();
      }

      if (result.shouldLogSet && assistant.getState().activeSet) {
        const logResult = await this.completeSet(userId);
        if (logResult.success) {
          return ok({
            state: logResult.data.state,
            spokenResponse: `${result.spokenResponse} Set logged.`,
            shouldLogSet: true,
          });
        }
      }

      return ok({
        state: result.state,
        spokenResponse: result.spokenResponse,
        shouldLogSet: result.shouldLogSet,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async completeSet(userId: string): Promise<ServiceResult<{ state: WatchWorkoutAssistantState; setId?: string }>> {
    try {
      const assistant = getAssistant(userId);
      const set = assistant.getState().activeSet;
      if (!set) return fail('No active set');

      const reps = set.currentRepCount > 0 ? set.currentRepCount : set.targetReps;
      const logResult = await workoutService.logSet({
        workoutExerciseId: set.workoutExerciseId,
        weight: set.weightLbs,
        reps,
      });

      if (!logResult.success) return fail(logResult.error);

      await persistRepEvent(userId, logResult.data.id, reps, set.motionConfidence, reps, true);

      assistant.startRest(90);

      return ok({ state: assistant.getState(), setId: logResult.data.id });
    } catch (e) {
      return fromError(e);
    }
  },

  /** Dev: simulate one detected rep via synthetic motion. */
  async simulateRep(userId: string): Promise<ServiceResult<{ state: WatchWorkoutAssistantState; spoken?: string }>> {
    try {
      const set = getAssistant(userId).getState().activeSet;
      if (!set) return fail('No active set');

      const profile = resolveExerciseProfile(set.exerciseName);
      if (!profile) return fail('Exercise not motion-tracked');

      const samples = synthesizeRepMotionBatch(profile, set.currentRepCount + 1);
      const motion = await this.processMotion(userId, samples);
      if (!motion.success) return fail(motion.error);

      return ok({ state: motion.data.state, spoken: motion.data.spokenPrompt });
    } catch (e) {
      return fromError(e);
    }
  },

  speak(text: string): void {
    Speech.speak(text, { rate: 0.95 });
  },

  buildWatchMessage(state: WatchWorkoutAssistantState): WatchWorkoutMessage {
    return { type: 'workout_state', state };
  },

  async handleIncomingMessage(
    userId: string,
    message: WatchWorkoutMessage,
  ): Promise<ServiceResult<WatchWorkoutAssistantState | { sessionId: string }>> {
    try {
      switch (message.type) {
        case 'motion_batch': {
          const r = await this.processMotion(userId, message.samples);
          if (!r.success) return fail(r.error);
          if (r.data.spokenPrompt) this.speak(r.data.spokenPrompt);
          return ok(r.data.state);
        }
        case 'voice_command': {
          const r = await this.handleVoice(userId, message.transcript);
          if (!r.success) return fail(r.error);
          this.speak(r.data.spokenResponse);
          return ok(r.data.state);
        }
        case 'rep_correction': {
          const r = await this.correctReps(userId, message.repCount);
          if (!r.success) return fail(r.error);
          this.speak(`Updated to rep ${message.repCount}.`);
          return ok(r.data);
        }
        case 'confirm_reps': {
          const r = await this.confirmReps(userId);
          return r.success ? ok(r.data) : fail(r.error);
        }
        case 'skip_rest': {
          await workoutService.skipActiveRestTimer(userId);
          const assistant = getAssistant(userId);
          const set = assistant.getState().activeSet;
          if (set) {
            assistant.loadState({
              ...assistant.getState(),
              activeSet: { ...set, phase: 'active_set', restSecondsRemaining: 0 },
              lastSpokenResponse: 'Rest skipped.',
              updatedAt: new Date().toISOString(),
            });
          }
          return ok(assistant.getState());
        }
        case 'log_set': {
          const r = await this.completeSet(userId);
          return r.success ? ok(r.data.state) : fail(r.error);
        }
        case 'next_set': {
          const assistant = getAssistant(userId);
          assistant.advanceToNextSet();
          return ok(assistant.getState());
        }
        case 'start_workout':
          return fail('start_workout is handled by watchCompanionService');
        case 'workout_state':
          getAssistant(userId).loadState(message.state);
          return ok(message.state);
        default:
          return fail('Unknown watch message type');
      }
    } catch (e) {
      return fromError(e);
    }
  },
};

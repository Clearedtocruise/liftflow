import { mapExercise, mapHistoryItem, mapSession, mapSet } from '@/lib/db-mappers';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IWorkoutService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';
import type { CreateSetPayload, Exercise, StartSessionPayload, UpdateSetPayload, WorkoutSession } from '@/types';
import type { ServiceResult } from '@/types/common';
import type { EditableWorkoutExercise, ExerciseHistorySet } from '@/types/workoutExecution';

type PlannedExerciseTemplate = {
  name: string;
  sets?: number;
  reps?: string;
  weightLbs?: number;
  restSeconds?: number;
};

const SESSION_SELECT = `
  *,
  workout_exercises (
    *,
    exercises (*),
    workout_sets (*)
  )
`;

async function loadSession(sessionId: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;
  return mapSession(data);
}

async function recalculateSessionTotals(sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;

  let totalSets = 0;
  let totalVolume = 0;

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      totalSets += 1;
      if (set.weight && set.reps) {
        totalVolume += set.weight * set.reps;
      }
    }
  }

  await supabase
    .from('workout_sessions')
    .update({ total_sets: totalSets, total_volume: totalVolume })
    .eq('id', sessionId);
}

async function detectPersonalRecord(
  userId: string,
  workoutExerciseId: string,
  weight: number | undefined,
  reps: number | undefined,
  excludeSetId?: string,
): Promise<boolean> {
  if (!weight || !reps) return false;

  const { data: exerciseRow } = await supabase
    .from('workout_exercises')
    .select('exercise_id')
    .eq('id', workoutExerciseId)
    .single();

  if (!exerciseRow?.exercise_id) return false;

  const { data: userExercises } = await supabase
    .from('workout_exercises')
    .select('id, workout_sessions!inner(user_id)')
    .eq('exercise_id', exerciseRow.exercise_id)
    .eq('workout_sessions.user_id', userId);

  const exerciseIds = (userExercises ?? []).map((row) => row.id);
  if (exerciseIds.length === 0) return true;

  let query = supabase
    .from('workout_sets')
    .select('id, weight, reps')
    .in('workout_exercise_id', exerciseIds);

  if (excludeSetId) {
    query = query.neq('id', excludeSetId);
  }

  const { data: priorSets } = await query;
  if (!priorSets || priorSets.length === 0) return true;

  const volume = weight * reps;
  let maxWeight = 0;
  let maxVolume = 0;

  for (const set of priorSets) {
    const setWeight = set.weight ?? 0;
    const setReps = set.reps ?? 0;
    if (setWeight > maxWeight) maxWeight = setWeight;
    const setVolume = setWeight * setReps;
    if (setVolume > maxVolume) maxVolume = setVolume;
  }

  return weight > maxWeight || volume > maxVolume;
}

async function getSessionUserId(workoutExerciseId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workout_exercises')
    .select('session_id, workout_sessions(user_id)')
    .eq('id', workoutExerciseId)
    .single();

  const session = data?.workout_sessions as { user_id: string } | null | undefined;
  return session?.user_id ?? null;
}

async function loadPlannedExercises(plannedWorkoutId: string): Promise<PlannedExerciseTemplate[]> {
  const { data: planned } = await supabase
    .from('planned_workouts')
    .select('metadata, template_id, workout_templates!planned_workouts_template_id_fkey(exercises)')
    .eq('id', plannedWorkoutId)
    .maybeSingle();

  if (!planned) return [];

  const metadata = planned.metadata as { exercises?: PlannedExerciseTemplate[] } | null;
  if (metadata?.exercises?.length) return metadata.exercises;

  const template = planned.workout_templates as { exercises?: PlannedExerciseTemplate[] } | null;
  return template?.exercises ?? [];
}

async function findOrCreateExerciseByNameInternal(name: string, userId: string): Promise<string | null> {
  const normalized = name.trim();
  const { data: found } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', normalized)
    .limit(1)
    .maybeSingle();

  if (found?.id) return found.id;

  const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { data: created, error } = await supabase
    .from('exercises')
    .insert({
      name: normalized,
      slug,
      category: 'other',
      equipment: 'other',
      muscle_groups: ['general'],
      is_system: false,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !created) return null;
  return created.id;
}

async function preloadSessionExercises(
  sessionId: string,
  userId: string,
  exercises: PlannedExerciseTemplate[],
): Promise<void> {
  for (let i = 0; i < exercises.length; i++) {
    const template = exercises[i];
    const normalized = template.name.trim();
    const { data: found } = await supabase
      .from('exercises')
      .select('id')
      .ilike('name', normalized)
      .limit(1)
      .maybeSingle();

    let exerciseId = found?.id;
    if (!exerciseId) {
      const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: created } = await supabase
        .from('exercises')
        .insert({
          name: normalized,
          slug,
          category: 'custom',
          equipment: 'other',
          muscle_groups: [],
          is_system: false,
          created_by: userId,
        })
        .select('id')
        .single();
      exerciseId = created?.id;
    }
    if (!exerciseId) continue;

    await supabase.from('workout_exercises').insert({
      session_id: sessionId,
      exercise_id: exerciseId,
      sort_order: i,
      suggested_reps: template.reps ?? undefined,
      suggested_weight: template.weightLbs ? template.weightLbs / 2.2046226218 : undefined,
    });
  }
}

async function syncPlannedWorkoutStatus(
  plannedWorkoutId: string,
  status: 'planned' | 'active' | 'completed' | 'cancelled',
): Promise<void> {
  await supabase.from('planned_workouts').update({ status }).eq('id', plannedWorkoutId);
}

async function createWorkoutSession(
  userId: string,
  payload: StartSessionPayload,
): Promise<ServiceResult<WorkoutSession>> {
  const { data: existing } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .limit(1)
    .maybeSingle();

  if (existing) {
    const session = await loadSession(existing.id);
    if (session) return ok(session);
  }

  const metadata: Record<string, unknown> = {};
  if (payload.workoutLocationId) metadata.workout_location_id = payload.workoutLocationId;
  if (payload.gymName) metadata.location_name = payload.gymName;
  if (payload.trainingLocation) metadata.training_location = payload.trainingLocation;

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      name: payload.name,
      status: 'active',
      planned_workout_id: payload.plannedWorkoutId,
      metadata,
    })
    .select('id')
    .single();

  if (error) return fail(error.message);
  const session = await loadSession(data.id);
  if (!session) return fail('Failed to load new session');
  return ok(session);
}

async function applySessionExercisePlanInternal(
  sessionId: string,
  userId: string,
  exercises: EditableWorkoutExercise[],
): Promise<ServiceResult<WorkoutSession>> {
  try {
    let session = await loadSession(sessionId);
    if (!session) return fail('Session not found');

    const desiredNames = exercises.map((exercise) => exercise.name.trim().toLowerCase());
    for (const current of session.exercises) {
      const name = current.exercise?.name?.trim().toLowerCase() ?? '';
      if (!desiredNames.includes(name)) {
        await supabase.from('workout_sets').delete().eq('workout_exercise_id', current.id);
        await supabase.from('workout_exercises').delete().eq('id', current.id);
      }
    }

    session = await loadSession(sessionId);
    if (!session) return fail('Session not found');

    for (let index = 0; index < exercises.length; index += 1) {
      const template = exercises[index];
      const normalized = template.name.trim();
      const existing = session.exercises.find(
        (exercise) => exercise.exercise?.name?.trim().toLowerCase() === normalized.toLowerCase(),
      );

      if (existing) {
        await supabase
          .from('workout_exercises')
          .update({
            sort_order: index,
            suggested_reps: template.repRange ?? undefined,
            suggested_weight: template.weightLbs ? template.weightLbs / 2.2046226218 : undefined,
          })
          .eq('id', existing.id);
        continue;
      }

      const exerciseIdResult = await findOrCreateExerciseByNameInternal(normalized, userId);
      if (!exerciseIdResult) continue;

      await supabase.from('workout_exercises').insert({
        session_id: sessionId,
        exercise_id: exerciseIdResult,
        sort_order: index,
        suggested_reps: template.repRange ?? undefined,
        suggested_weight: template.weightLbs ? template.weightLbs / 2.2046226218 : undefined,
      });
    }

    const updated = await loadSession(sessionId);
    if (!updated) return fail('Failed to load session');
    return ok(updated);
  } catch (e) {
    return fromError(e);
  }
}

export const workoutService: IWorkoutService = {
  async startSession(userId, payload: StartSessionPayload) {
    try {
      return await createWorkoutSession(userId, payload);
    } catch (e) {
      return fromError(e);
    }
  },

  async startSessionFromPlanned(userId, plannedWorkoutId, payload) {
    try {
      const { data: planned, error: plannedError } = await supabase
        .from('planned_workouts')
        .select('id, name, status, metadata, template_id')
        .eq('id', plannedWorkoutId)
        .eq('user_id', userId)
        .maybeSingle();

      if (plannedError) return fail(plannedError.message);
      if (!planned) return fail('Planned workout not found');

      // Resume path: never re-apply the plan onto an existing session — that deletes
      // swapped exercises / logged sets and can hang past the client start timeout.
      const existing = await this.getActiveSession(userId);
      if (existing.success && existing.data) {
        if (
          !existing.data.plannedWorkoutId ||
          existing.data.plannedWorkoutId === plannedWorkoutId
        ) {
          if (existing.data.status === 'paused') {
            const resumed = await this.resumeSession(existing.data.id);
            if (resumed.success) return resumed;
          }
          await syncPlannedWorkoutStatus(plannedWorkoutId, 'active');
          return ok(existing.data);
        }
        return fail('Another workout is already in progress. Finish or cancel it first.');
      }

      const startResult = await createWorkoutSession(userId, {
        ...payload,
        plannedWorkoutId,
        name: payload.name || planned.name,
      });

      if (!startResult.success) return startResult;

      // createWorkoutSession may still return a race-created existing session.
      const isFreshSession = (startResult.data.exercises?.length ?? 0) === 0;

      if (isFreshSession) {
        if (payload.exercisePlan && payload.exercisePlan.length > 0) {
          const applyResult = await applySessionExercisePlanInternal(
            startResult.data.id,
            userId,
            payload.exercisePlan,
          );
          if (!applyResult.success) return applyResult;
        } else {
          const exercises = await loadPlannedExercises(plannedWorkoutId);
          if (exercises.length > 0) {
            await preloadSessionExercises(startResult.data.id, userId, exercises);
          }
        }
      }

      await syncPlannedWorkoutStatus(plannedWorkoutId, 'active');

      const session = await loadSession(startResult.data.id);
      if (!session) return fail('Failed to load session');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async getActiveSession(userId) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_SELECT)
        .eq('user_id', userId)
        .in('status', ['active', 'paused'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail(error.message);
      if (!data) return ok(null);
      return ok(mapSession(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async endSession(sessionId, options?: { caloriesBurned?: number }) {
    try {
      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');

      const endedAt = new Date();
      const durationSeconds = Math.round(
        (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000,
      );

      const update: Record<string, unknown> = {
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      };
      if (options?.caloriesBurned != null && options.caloriesBurned > 0) {
        update.calories_burned = Math.round(options.caloriesBurned);
      }

      const { error } = await supabase
        .from('workout_sessions')
        .update(update)
        .eq('id', sessionId);

      if (error) return fail(error.message);

      await recalculateSessionTotals(sessionId);

      if (session.plannedWorkoutId) {
        await syncPlannedWorkoutStatus(session.plannedWorkoutId, 'completed');
      }

      const updated = await loadSession(sessionId);
      if (!updated) return fail('Failed to load completed session');
      return ok(updated);
    } catch (e) {
      return fromError(e);
    }
  },

  async pauseSession(sessionId) {
    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ status: 'paused' })
        .eq('id', sessionId);

      if (error) return fail(error.message);

      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async resumeSession(sessionId) {
    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId);

      if (error) return fail(error.message);

      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async cancelSession(sessionId) {
    try {
      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');

      const { error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) return fail(error.message);

      if (session.plannedWorkoutId) {
        await syncPlannedWorkoutStatus(session.plannedWorkoutId, 'planned');
      }

      const updated = await loadSession(sessionId);
      if (!updated) return fail('Session not found');
      return ok(updated);
    } catch (e) {
      return fromError(e);
    }
  },

  async logSet(payload: CreateSetPayload) {
    try {
      const { data: existingSets } = await supabase
        .from('workout_sets')
        .select('set_number')
        .eq('workout_exercise_id', payload.workoutExerciseId)
        .order('set_number', { ascending: false })
        .limit(1);

      const setNumber = (existingSets?.[0]?.set_number ?? 0) + 1;
      const userId = await getSessionUserId(payload.workoutExerciseId);
      const isPr = userId
        ? await detectPersonalRecord(userId, payload.workoutExerciseId, payload.weight, payload.reps)
        : false;

      const metadata =
        payload.distanceMeters != null ? { distanceMeters: payload.distanceMeters } : undefined;

      const { data, error } = await supabase
        .from('workout_sets')
        .insert({
          workout_exercise_id: payload.workoutExerciseId,
          set_number: setNumber,
          weight: payload.weight,
          reps: payload.reps,
          set_type: payload.type ?? 'normal',
          duration_seconds: payload.durationSeconds,
          metadata: metadata ?? {},
          is_pr: isPr,
          logged_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      const { data: exerciseRow } = await supabase
        .from('workout_exercises')
        .select('session_id')
        .eq('id', payload.workoutExerciseId)
        .single();

      if (exerciseRow?.session_id) {
        await recalculateSessionTotals(exerciseRow.session_id);
      }

      return ok(mapSet(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async updateSet(setId, payload: UpdateSetPayload) {
    try {
      const { data: existing } = await supabase
        .from('workout_sets')
        .select('workout_exercise_id, weight, reps')
        .eq('id', setId)
        .single();

      if (!existing) return fail('Set not found');

      const weight = payload.weight ?? existing.weight ?? undefined;
      const reps = payload.reps ?? existing.reps ?? undefined;
      const userId = await getSessionUserId(existing.workout_exercise_id);
      const isPr = userId
        ? await detectPersonalRecord(userId, existing.workout_exercise_id, weight, reps, setId)
        : false;

      const updatePayload: Record<string, unknown> = { is_pr: isPr };
      if (payload.weight !== undefined) updatePayload.weight = payload.weight;
      if (payload.reps !== undefined) updatePayload.reps = payload.reps;
      if (payload.type !== undefined) updatePayload.set_type = payload.type;
      if (payload.rpe !== undefined) updatePayload.rpe = payload.rpe;
      if (payload.notes !== undefined) updatePayload.notes = payload.notes;

      const { data, error } = await supabase
        .from('workout_sets')
        .update(updatePayload)
        .eq('id', setId)
        .select('*')
        .single();

      if (error) return fail(error.message);

      const { data: exerciseRow } = await supabase
        .from('workout_exercises')
        .select('session_id')
        .eq('id', existing.workout_exercise_id)
        .single();

      if (exerciseRow?.session_id) {
        await recalculateSessionTotals(exerciseRow.session_id);
      }

      return ok(mapSet(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async deleteSet(setId) {
    try {
      const { data: setRow } = await supabase
        .from('workout_sets')
        .select('workout_exercise_id')
        .eq('id', setId)
        .single();

      const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (error) return fail(error.message);

      if (setRow?.workout_exercise_id) {
        const { data: exerciseRow } = await supabase
          .from('workout_exercises')
          .select('session_id')
          .eq('id', setRow.workout_exercise_id)
          .single();
        if (exerciseRow?.session_id) {
          await recalculateSessionTotals(exerciseRow.session_id);
        }
      }

      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async getHistory(userId, page = 1) {
    try {
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('workout_sessions')
        .select('*, workout_exercises(id, workout_sets(is_pr))', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .range(from, to);

      if (error) return fail(error.message);

      const items = (data ?? []).map((row) =>
        mapHistoryItem({ ...row, workout_exercises: row.workout_exercises }),
      );

      return ok({
        data: items,
        total: count ?? items.length,
        page,
        pageSize,
        hasMore: (count ?? 0) > page * pageSize,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async getSession(sessionId) {
    try {
      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async deleteSession(sessionId) {
    try {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
      if (error) return fail(error.message);
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async updateSession(sessionId, updates: { name?: string; notes?: string }) {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      const { error } = await supabase.from('workout_sessions').update(payload).eq('id', sessionId);
      if (error) return fail(error.message);

      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async addExercise(sessionId, exerciseId, sortOrder?: number) {
    try {
      if (sortOrder != null) {
        const { data: toShift, error: shiftError } = await supabase
          .from('workout_exercises')
          .select('id, sort_order')
          .eq('session_id', sessionId)
          .gte('sort_order', sortOrder)
          .order('sort_order', { ascending: false });

        if (shiftError) return fail(shiftError.message);

        for (const row of toShift ?? []) {
          const { error: updateError } = await supabase
            .from('workout_exercises')
            .update({ sort_order: row.sort_order + 1 })
            .eq('id', row.id);
          if (updateError) return fail(updateError.message);
        }
      }

      const { data: existing } = await supabase
        .from('workout_exercises')
        .select('sort_order')
        .eq('session_id', sessionId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const order = sortOrder ?? ((existing?.[0]?.sort_order ?? -1) + 1);

      const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
          session_id: sessionId,
          exercise_id: exerciseId,
          sort_order: order,
        })
        .select('id')
        .single();

      if (error) return fail(error.message);

      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');
      const exercise = session.exercises.find((e) => e.id === data.id);
      if (!exercise) return fail('Exercise not found');
      return ok(exercise);
    } catch (e) {
      return fromError(e);
    }
  },

  async findOrCreateExerciseByName(name: string, userId: string) {
    try {
      const exerciseId = await findOrCreateExerciseByNameInternal(name, userId);
      if (!exerciseId) return fail('Could not create exercise');
      return ok(exerciseId);
    } catch (e) {
      return fromError(e);
    }
  },

  async createCustomExercise(
    userId: string,
    input: {
      name: string;
      equipment?: string;
      muscleGroup?: string;
      exerciseType?: Exercise['exerciseType'];
      notes?: string;
    },
  ) {
    try {
      const normalized = input.name.trim();
      if (!normalized) return fail('Name is required');
      const slug = `custom-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: normalized,
          slug,
          category: 'other',
          equipment: input.equipment?.trim() || 'other',
          muscle_groups: [input.muscleGroup?.trim() || 'general'],
          exercise_type: input.exerciseType ?? 'strength',
          instructions: input.notes?.trim() || null,
          is_system: false,
          created_by: userId,
        })
        .select('id, name, slug, category, equipment, muscle_groups, exercise_type, is_system, created_by, created_at')
        .single();

      if (error || !data) return fail(error?.message ?? 'Could not create exercise');

      if (input.notes?.trim()) {
        await supabase.from('user_custom_exercises').upsert(
          {
            user_id: userId,
            exercise_id: data.id,
            notes: input.notes.trim(),
          },
          { onConflict: 'user_id,exercise_id' },
        );
      }

      return ok(
        mapExercise({
          ...data,
          secondary_muscles: null,
          tutorial_url: null,
          instructions: input.notes?.trim() ?? null,
          updated_at: data.created_at,
        }),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async startRestTimer(sessionId, setId, recommendedSeconds) {
    try {
      const { data, error } = await supabase
        .from('rest_periods')
        .insert({
          session_id: sessionId,
          workout_set_id: setId,
          recommended_seconds: recommendedSeconds,
          started_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        sessionId: data.session_id,
        workoutSetId: data.workout_set_id ?? undefined,
        recommendedSeconds: data.recommended_seconds ?? undefined,
        actualSeconds: data.actual_seconds ?? undefined,
        startedAt: data.started_at,
        endedAt: data.ended_at ?? undefined,
        wasSkipped: data.was_skipped ?? false,
        createdAt: data.started_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async skipActiveRestTimer(userId: string) {
    try {
      const sessionResult = await this.getActiveSession(userId);
      if (!sessionResult.success || !sessionResult.data) return ok(undefined);

      const { data: rest, error } = await supabase
        .from('rest_periods')
        .select('*')
        .eq('session_id', sessionResult.data.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail(error.message);
      if (!rest) return ok(undefined);

      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(rest.started_at).getTime()) / 1000),
      );
      const ended = await this.endRestTimer(rest.id, elapsed, true);
      if (!ended.success) return ended;
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async endRestTimer(restPeriodId, actualSeconds, wasSkipped = false) {
    try {
      const { data, error } = await supabase
        .from('rest_periods')
        .update({
          actual_seconds: actualSeconds,
          ended_at: new Date().toISOString(),
          was_skipped: wasSkipped,
        })
        .eq('id', restPeriodId)
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        sessionId: data.session_id,
        workoutSetId: data.workout_set_id ?? undefined,
        recommendedSeconds: data.recommended_seconds ?? undefined,
        actualSeconds: data.actual_seconds ?? undefined,
        startedAt: data.started_at,
        endedAt: data.ended_at ?? undefined,
        wasSkipped: data.was_skipped ?? false,
        createdAt: data.started_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async calculateDensity(sessionId) {
    try {
      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');

      const durationMinutes = session.durationSeconds
        ? session.durationSeconds / 60
        : Math.max(1, (Date.now() - new Date(session.startedAt).getTime()) / 60000);

      const totalSets = session.totalSets ?? 0;
      const totalVolume = session.totalVolume ?? 0;

      const metrics = {
        session_id: sessionId,
        total_work_seconds: Math.round(durationMinutes * 60 * 0.7),
        total_rest_seconds: Math.round(durationMinutes * 60 * 0.3),
        sets_per_minute: totalSets / durationMinutes,
        volume_per_minute: totalVolume / durationMinutes,
        density_score: Math.min(100, Math.round((totalSets / durationMinutes) * 30)),
        calculated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('workout_density_metrics')
        .upsert(metrics, { onConflict: 'session_id' })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        sessionId: data.session_id,
        totalWorkSeconds: data.total_work_seconds ?? undefined,
        totalRestSeconds: data.total_rest_seconds ?? undefined,
        setsPerMinute: data.sets_per_minute ?? undefined,
        volumePerMinute: data.volume_per_minute ?? undefined,
        densityScore: data.density_score ?? undefined,
        calculatedAt: data.calculated_at,
        createdAt: data.calculated_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async removeExercise(workoutExerciseId: string) {
    try {
      await supabase.from('workout_sets').delete().eq('workout_exercise_id', workoutExerciseId);
      const { error } = await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);
      if (error) return fail(error.message);
      return ok(true);
    } catch (e) {
      return fromError(e);
    }
  },

  /** Swap the movement on an in-progress exercise row and rebuild that node (clears its sets). */
  async replaceSessionExercise(workoutExerciseId: string, newExerciseName: string, userId: string) {
    try {
      const normalized = newExerciseName.trim();
      if (!normalized) return fail('Exercise name is required');

      const exerciseId = await findOrCreateExerciseByNameInternal(normalized, userId);
      if (!exerciseId) return fail('Could not find or create exercise');

      const { data: row, error: loadError } = await supabase
        .from('workout_exercises')
        .select('session_id, exercise_id')
        .eq('id', workoutExerciseId)
        .maybeSingle();

      if (loadError) return fail(loadError.message);
      if (!row?.session_id) return fail('Exercise not found');

      // Rebuild this workout node: drop sets logged against the previous exercise so
      // loading schema / set progression cannot leak across the swap.
      if (row.exercise_id !== exerciseId) {
        const { error: clearSetsError } = await supabase
          .from('workout_sets')
          .delete()
          .eq('workout_exercise_id', workoutExerciseId);
        if (clearSetsError) return fail(clearSetsError.message);
      }

      const { error } = await supabase
        .from('workout_exercises')
        .update({ exercise_id: exerciseId })
        .eq('id', workoutExerciseId);

      if (error) return fail(error.message);

      const session = await loadSession(row.session_id);
      if (!session) return fail('Session not found');
      return ok(session);
    } catch (e) {
      return fromError(e);
    }
  },

  async updateExerciseSortOrders(updates: Array<{ id: string; sortOrder: number }>) {
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('workout_exercises')
          .update({ sort_order: update.sortOrder })
          .eq('id', update.id);
        if (error) return fail(error.message);
      }
      return ok(true);
    } catch (e) {
      return fromError(e);
    }
  },

  async searchExercises(query: string, userId: string, limit = 50) {
    try {
      let request = supabase
        .from('exercises')
        .select(
          'id, name, slug, category, equipment, muscle_groups, exercise_type, is_system, created_by, created_at',
        )
        .or(`is_system.eq.true,created_by.eq.${userId}`)
        .order('name')
        .limit(limit);

      if (query.trim()) {
        request = request.ilike('name', `%${query.trim()}%`);
      }

      const { data, error } = await request;
      if (error) return fail(error.message);

      const { classifyExercise } = await import('@/lib/exerciseClassification');
      const exercises: Exercise[] = (data ?? []).map((row) => {
        const storedType = (row.exercise_type as Exercise['exerciseType'] | null) ?? null;
        const exerciseType = classifyExercise({
          slug: row.slug,
          name: row.name,
          equipment: row.equipment,
          movementCategory: row.category,
          exerciseType: storedType,
        });
        return {
          id: row.id,
          name: row.name,
          slug: row.slug ?? undefined,
          category: row.category as Exercise['category'],
          exerciseType,
          equipment: row.equipment,
          muscleGroups: row.muscle_groups ?? [],
          isSystem: row.is_system ?? false,
          createdBy: row.created_by ?? undefined,
          createdAt: row.created_at,
        };
      });

      return ok(exercises);
    } catch (e) {
      return fromError(e);
    }
  },

  async getRecentSetsForExercise(
    userId: string,
    exerciseId: string,
    limit = 5,
    mode: import('@/lib/exerciseModality').ExerciseLoggingMode = 'weighted',
  ) {
    try {
      const { data: exerciseRows, error: exerciseError } = await supabase
        .from('workout_exercises')
        .select('id, workout_sessions!inner(user_id)')
        .eq('exercise_id', exerciseId)
        .eq('workout_sessions.user_id', userId);

      if (exerciseError) return fail(exerciseError.message);

      const workoutExerciseIds = (exerciseRows ?? []).map((row) => row.id);
      if (workoutExerciseIds.length === 0) return ok([] as ExerciseHistorySet[]);

      const { data, error } = await supabase
        .from('workout_sets')
        .select('weight, reps, duration_seconds, metadata, logged_at')
        .in('workout_exercise_id', workoutExerciseIds)
        .order('logged_at', { ascending: false })
        .limit(Math.max(limit * 3, limit));

      if (error) return fail(error.message);

      const sets: ExerciseHistorySet[] = (data ?? [])
        .map((row) => {
          const metadata = (row.metadata ?? {}) as Record<string, unknown>;
          const distanceMeters =
            typeof metadata.distanceMeters === 'number'
              ? metadata.distanceMeters
              : typeof metadata.distance_meters === 'number'
                ? metadata.distance_meters
                : undefined;
          return {
            weightKg: row.weight != null ? (row.weight as number) : undefined,
            reps: row.reps != null ? (row.reps as number) : undefined,
            durationSeconds: row.duration_seconds != null ? (row.duration_seconds as number) : undefined,
            distanceMeters,
            loggedAt: row.logged_at as string,
          };
        })
        .filter((set) => {
          if (mode === 'any') {
            return (
              (set.reps != null && set.reps > 0) ||
              (set.durationSeconds != null && set.durationSeconds > 0) ||
              (set.weightKg != null && set.weightKg > 0)
            );
          }
          if (mode === 'cardio') {
            return set.durationSeconds != null && set.durationSeconds > 0;
          }
          if (mode === 'timed') return set.durationSeconds != null && set.durationSeconds > 0;
          if (mode === 'bodyweight') return set.reps != null && (!set.weightKg || set.weightKg <= 0);
          return set.weightKg != null && set.weightKg > 0 && set.reps != null;
        })
        .slice(0, limit);

      return ok(sets);
    } catch (e) {
      return fromError(e);
    }
  },

  async listTrackedLiftExercises(userId: string, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(
          'started_at, workout_exercises(exercise_id, exercises(id, name), workout_sets(weight, reps, logged_at))',
        )
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(40);

      if (error) return fail(error.message);

      type SetRow = { weight: number | null; reps: number | null; logged_at: string | null };
      type ExerciseRow = {
        exercise_id: string | null;
        exercises: { id: string; name: string } | { id: string; name: string }[] | null;
        workout_sets: SetRow[] | null;
      };

      const byExercise = new Map<
        string,
        {
          exerciseId: string;
          name: string;
          lastLoggedAt: string;
          setCount: number;
          lastWeightKg?: number;
          lastReps?: number;
        }
      >();

      for (const session of data ?? []) {
        for (const row of (session.workout_exercises ?? []) as ExerciseRow[]) {
          const exerciseId = row.exercise_id;
          if (!exerciseId) continue;
          const exerciseRel = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
          const name = exerciseRel?.name?.trim() || 'Exercise';
          const sets = [...(row.workout_sets ?? [])].sort((a, b) =>
            String(b.logged_at ?? '').localeCompare(String(a.logged_at ?? '')),
          );
          const weighted = sets.filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
          const countable = weighted.length > 0 ? weighted : sets.filter((s) => (s.reps ?? 0) > 0);
          if (countable.length === 0) continue;

          const newest = countable[0]!;
          const loggedAt =
            newest.logged_at ?? (session as { started_at?: string }).started_at ?? new Date(0).toISOString();
          const existing = byExercise.get(exerciseId);
          if (!existing) {
            byExercise.set(exerciseId, {
              exerciseId,
              name,
              lastLoggedAt: loggedAt,
              setCount: countable.length,
              lastWeightKg: newest.weight != null && newest.weight > 0 ? newest.weight : undefined,
              lastReps: newest.reps ?? undefined,
            });
            continue;
          }
          existing.setCount += countable.length;
          if (loggedAt > existing.lastLoggedAt) {
            existing.lastLoggedAt = loggedAt;
            existing.lastWeightKg =
              newest.weight != null && newest.weight > 0 ? newest.weight : undefined;
            existing.lastReps = newest.reps ?? undefined;
            existing.name = name;
          }
        }
      }

      const ranked = [...byExercise.values()]
        .sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt))
        .slice(0, Math.max(1, limit));

      return ok(ranked);
    } catch (e) {
      return fromError(e);
    }
  },

  async getExerciseProgressSets(userId: string, exerciseId: string, limit = 80) {
    return this.getRecentSetsForExercise(userId, exerciseId, limit, 'any');
  },

  async applySessionExercisePlan(sessionId: string, userId: string, exercises: EditableWorkoutExercise[]) {
    return applySessionExercisePlanInternal(sessionId, userId, exercises);
  },
};

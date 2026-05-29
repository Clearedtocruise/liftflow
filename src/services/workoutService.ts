import { mapHistoryItem, mapSession, mapSet } from '@/lib/db-mappers';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IWorkoutService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';
import type { CreateSetPayload, StartSessionPayload, WorkoutSession } from '@/types';

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

export const workoutService: IWorkoutService = {
  async startSession(userId, payload: StartSessionPayload) {
    try {
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

      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          name: payload.name,
          status: 'active',
          planned_workout_id: payload.plannedWorkoutId,
        })
        .select('id')
        .single();

      if (error) return fail(error.message);
      const session = await loadSession(data.id);
      if (!session) return fail('Failed to load new session');
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

  async endSession(sessionId) {
    try {
      const session = await loadSession(sessionId);
      if (!session) return fail('Session not found');

      const endedAt = new Date();
      const durationSeconds = Math.round(
        (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000,
      );

      const { error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', sessionId);

      if (error) return fail(error.message);

      const updated = await loadSession(sessionId);
      if (!updated) return fail('Failed to load completed session');
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

      const { data, error } = await supabase
        .from('workout_sets')
        .insert({
          workout_exercise_id: payload.workoutExerciseId,
          set_number: setNumber,
          weight: payload.weight,
          reps: payload.reps,
          set_type: payload.type ?? 'normal',
          duration_seconds: payload.durationSeconds,
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
        .select('*, workout_exercises(id)', { count: 'exact' })
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
      const normalized = name.trim();
      const { data: found } = await supabase
        .from('exercises')
        .select('id')
        .ilike('name', normalized)
        .limit(1)
        .maybeSingle();

      if (found) return ok(found.id);

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

      if (error) return fail(error.message);
      return ok(created.id);
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

  async endRestTimer(restPeriodId, actualSeconds) {
    try {
      const { data, error } = await supabase
        .from('rest_periods')
        .update({
          actual_seconds: actualSeconds,
          ended_at: new Date().toISOString(),
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
};

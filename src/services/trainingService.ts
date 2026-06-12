import { api, apiClient } from '@/api/client';
import { WORKOUT_PLAN_RULES_VERSION } from '@/constants/workout';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { ITrainingService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type {
    CreateProgramPayload,
    PlannedWorkout,
    ProgramDashboard,
    RecoveryAssessment,
    SuggestedMuscleGroups,
    TrainingPhase,
    TrainingProgram,
    WorkoutTemplate,
} from '@/types';

type PlannedRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  training_phase_id: string | null;
  name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  suggested_muscle_groups: string[] | null;
  ai_rationale: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function mapPlanned(row: PlannedRow): PlannedWorkout {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id ?? undefined,
    trainingPhaseId: row.training_phase_id ?? undefined,
    name: row.name,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time ?? undefined,
    status: row.status as PlannedWorkout['status'],
    suggestedMuscleGroups: row.suggested_muscle_groups ?? [],
    aiRationale: row.ai_rationale ?? undefined,
    metadata: (row.metadata ?? undefined) as PlannedWorkout['metadata'],
    createdAt: row.created_at,
  };
}

function mapProgramDashboard(raw: Record<string, unknown>): ProgramDashboard {
  const program = raw.program as Record<string, unknown>;
  const phase = raw.phase as Record<string, unknown> | null;

  return {
    program: {
      id: program.id as string,
      userId: program.user_id as string,
      name: program.name as string,
      description: program.description as string | undefined,
      durationWeeks: program.duration_weeks as number | undefined,
      isActive: program.is_active as boolean,
      metadata: (program.metadata as Record<string, unknown>) ?? undefined,
      createdAt: program.created_at as string,
    },
    phase: phase
      ? {
          id: phase.id as string,
          userId: phase.user_id as string,
          programId: phase.program_id as string | undefined,
          name: phase.name as string,
          phaseType: phase.phase_type as TrainingPhase['phaseType'],
          startDate: phase.start_date as string,
          endDate: phase.end_date as string | undefined,
          targetMuscleGroups: (phase.target_muscle_groups as string[]) ?? [],
          notes: phase.notes as string | undefined,
          metadata: (phase.metadata as Record<string, unknown>) ?? undefined,
          createdAt: phase.created_at as string,
        }
      : null,
    currentWeek: raw.currentWeek as number,
    completionPct: raw.completionPct as number,
    nextWorkout: raw.nextWorkout ? mapPlanned(raw.nextWorkout as PlannedRow) : null,
    upcomingWorkouts: ((raw.upcomingWorkouts as PlannedRow[]) ?? []).map(mapPlanned),
    totalPlanned: raw.totalPlanned as number,
    totalCompleted: raw.totalCompleted as number,
  };
}

export const trainingService: ITrainingService = {
  async getPrograms(userId) {
    try {
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              name: row.name,
              description: row.description ?? undefined,
              durationWeeks: row.duration_weeks ?? undefined,
              isActive: row.is_active ?? false,
              metadata: row.metadata ?? undefined,
              createdAt: row.created_at,
            }) satisfies TrainingProgram,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async getActivePhase(userId) {
    try {
      const { data: program } = await supabase
        .from('training_programs')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!program) return ok(null);

      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('training_phases')
        .select('*')
        .eq('program_id', program.id)
        .lte('start_date', today)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return fail(error.message);
      if (!data) return ok(null);

      return ok({
        id: data.id,
        userId: data.user_id,
        programId: data.program_id ?? undefined,
        name: data.name,
        phaseType: data.phase_type,
        startDate: data.start_date,
        endDate: data.end_date ?? undefined,
        targetMuscleGroups: data.target_muscle_groups ?? [],
        notes: data.notes ?? undefined,
        metadata: data.metadata ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async getTemplates(userId) {
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map(
          (row) =>
            ({
              id: row.id,
              userId: row.user_id,
              name: row.name,
              description: row.description ?? undefined,
              muscleGroups: row.muscle_groups ?? [],
              estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
              exercises: row.exercises ?? [],
              isSystem: row.is_system ?? false,
              createdAt: row.created_at,
            }) satisfies WorkoutTemplate,
        ),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async getPlannedWorkouts(userId, from, to) {
    try {
      const token = await getAccessToken();
      const remote = await apiClient.get<PlannedRow[]>(
        `/api/training/programs/planned?userId=${userId}&from=${from}&to=${to}`,
        token,
      );
      return ok((remote ?? []).map(mapPlanned));
    } catch {
      const { data, error } = await supabase
        .from('planned_workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date', { ascending: true });

      if (error) return fail(error.message);
      return ok((data ?? []).map((row) => mapPlanned(row as PlannedRow)));
    }
  },

  async suggestMuscleGroups(userId) {
    try {
      const token = await getAccessToken();
      const data = await api.suggestMuscleGroups(userId, token);
      return ok(data as SuggestedMuscleGroups);
    } catch (e) {
      return fromError(e);
    }
  },

  async assessRecovery(userId) {
    try {
      const token = await getAccessToken();
      const data = await api.assessRecovery(userId, token);
      return ok(data as RecoveryAssessment);
    } catch (e) {
      return fromError(e);
    }
  },

  async createPlannedWorkout(userId, workout) {
    try {
      const { data, error } = await supabase
        .from('planned_workouts')
        .insert({
          user_id: userId,
          template_id: workout.templateId,
          training_phase_id: workout.trainingPhaseId,
          name: workout.name,
          scheduled_date: workout.scheduledDate,
          scheduled_time: workout.scheduledTime,
          status: workout.status,
          suggested_muscle_groups: workout.suggestedMuscleGroups,
          ai_rationale: workout.aiRationale,
          metadata: workout.metadata ?? {},
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapPlanned(data as PlannedRow));
    } catch (e) {
      return fromError(e);
    }
  },

  async generateProgram(userId: string, payload: CreateProgramPayload) {
    try {
      const token = await getAccessToken();
      await apiClient.post('/api/training/programs/generate', { userId, ...payload }, token);
      return this.getDashboard(userId);
    } catch (e) {
      return fromError(e);
    }
  },

  async regenerateProgramIfNeeded(userId: string) {
    try {
      const dashboard = await this.getDashboard(userId);
      if (dashboard.success && dashboard.data) {
        const version = dashboard.data.program.metadata?.planRulesVersion;
        if (version === WORKOUT_PLAN_RULES_VERSION) {
          return ok({ regenerated: false });
        }
      }

      const token = await getAccessToken();
      const result = await api.regenerateProgram(userId, token);
      return ok({ regenerated: result.regenerated });
    } catch (e) {
      return fromError(e);
    }
  },

  async getDashboard(userId: string) {
    try {
      const token = await getAccessToken();
      const raw = await apiClient.get<Record<string, unknown> | null>(
        `/api/training/programs/dashboard?userId=${userId}`,
        token,
      );
      if (!raw) return ok(null);
      return ok(mapProgramDashboard(raw));
    } catch (e) {
      return fromError(e);
    }
  },

  async adaptProgram(userId: string) {
    try {
      const token = await getAccessToken();
      await apiClient.post('/api/training/programs/adapt', { userId }, token);
      return this.getDashboard(userId);
    } catch (e) {
      return fromError(e);
    }
  },

  async rescheduleWorkout(plannedWorkoutId: string, scheduledDate: string) {
    try {
      const token = await getAccessToken();
      const row = await apiClient.request<PlannedRow>(`/api/training/programs/planned/${plannedWorkoutId}/reschedule`, {
        method: 'PATCH',
        body: { scheduledDate },
        token,
      });
      return ok(mapPlanned(row));
    } catch (e) {
      return fromError(e);
    }
  },
};

export type TrainingService = typeof trainingService & {
  generateProgram(userId: string, payload: CreateProgramPayload): Promise<import('@/types/common').ServiceResult<ProgramDashboard | null>>;
  getDashboard(userId: string): Promise<import('@/types/common').ServiceResult<ProgramDashboard | null>>;
  adaptProgram(userId: string): Promise<import('@/types/common').ServiceResult<ProgramDashboard | null>>;
  rescheduleWorkout(plannedWorkoutId: string, scheduledDate: string): Promise<import('@/types/common').ServiceResult<PlannedWorkout>>;
};

import { applySubstitutionsToExercises, type LimitationContext } from './exerciseSubstitution.js';
import { applyWeeklyProgression, totalPlannedVolume } from './programProgression.js';
import {
    addDays,
    buildWeeklySchedule,
    currentProgramWeek,
    dayLabel,
    phaseForWeek,
    programTypeLabel,
    weekStartFromDate,
    type DaySlot,
    type ProgramFrequency,
    type ProgramType,
} from './programTypes.js';
import { requireAdmin } from './supabase.js';
import {
    buildAdaptiveWorkoutPlan,
    getLastPerformanceBySlug,
    loadActiveLimitations,
    loadRecoveryModifiers,
    type GeneratedWorkoutExercise
} from './workoutPlanner.js';

export type CreateProgramInput = {
  userId: string;
  programType: ProgramType;
  frequency: ProgramFrequency;
  goal?: string;
  experience?: string;
  durationWeeks?: number;
  equipment?: string[];
  locationId?: string;
  locationName?: string;
  customSchedule?: string[];
};

export type ProgramDashboard = {
  program: Record<string, unknown>;
  phase: Record<string, unknown> | null;
  currentWeek: number;
  completionPct: number;
  nextWorkout: Record<string, unknown> | null;
  upcomingWorkouts: Record<string, unknown>[];
  totalPlanned: number;
  totalCompleted: number;
};

function scaleExercises(
  exercises: GeneratedWorkoutExercise[],
  volumeMultiplier: number,
  repRangeAdjust?: string,
): GeneratedWorkoutExercise[] {
  return exercises.map((ex) => ({
    ...ex,
    sets: Math.max(1, Math.round(ex.sets * volumeMultiplier)),
    reps: repRangeAdjust ?? ex.reps,
  }));
}

async function ensurePhaseForWeek(
  userId: string,
  programId: string,
  weekNumber: number,
  totalWeeks: number,
  startDate: string,
): Promise<string> {
  const db = requireAdmin();
  const spec = phaseForWeek(weekNumber, totalWeeks);

  const { data: phases } = await db.from('training_phases').select('id, metadata').eq('program_id', programId);
  const existing = phases?.find(
    (row) =>
      (row.metadata as { weekNumber?: number })?.weekNumber === weekNumber,
  );
  if (existing) return existing.id;

  const weekStart = addDays(startDate, (weekNumber - 1) * 7);
  const { data: phase, error } = await db
    .from('training_phases')
    .insert({
      user_id: userId,
      program_id: programId,
      name: `${spec.sprintPhase.charAt(0).toUpperCase()}${spec.sprintPhase.slice(1)} — Week ${weekNumber}`,
      phase_type: spec.phaseType,
      start_date: weekStart,
      end_date: addDays(weekStart, 6),
      notes: `Auto-managed ${spec.sprintPhase} phase`,
      metadata: {
        sprintPhase: spec.sprintPhase,
        weekNumber,
        volumeMultiplier: spec.volumeMultiplier,
        intensityMultiplier: spec.intensityMultiplier,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return phase.id;
}

async function resolveProgramEquipment(
  userId: string,
  input: CreateProgramInput,
): Promise<string[] | undefined> {
  if (input.equipment?.length) return input.equipment;
  if (!input.locationId) return undefined;

  const db = requireAdmin();
  const { data } = await db
    .from('workout_locations')
    .select('available_equipment')
    .eq('id', input.locationId)
    .eq('user_id', userId)
    .maybeSingle();

  return data?.available_equipment?.length ? data.available_equipment : undefined;
}

export async function generateTrainingProgram(input: CreateProgramInput) {
  const db = requireAdmin();
  const durationWeeks = input.durationWeeks ?? 12;
  const startDate = weekStartFromDate(new Date().toISOString().slice(0, 10));
  const schedule = buildWeeklySchedule(input.programType, input.frequency, input.customSchedule);
  const limitations = await loadActiveLimitations(input.userId);
  const performance = await getLastPerformanceBySlug(input.userId);
  const recoveryMods = await loadRecoveryModifiers(input.userId);
  const equipment = await resolveProgramEquipment(input.userId, input);

  await db.from('training_programs').update({ is_active: false }).eq('user_id', input.userId);

  const programName = `${programTypeLabel(input.programType)} — ${input.frequency === 'custom' ? 'Custom' : `${input.frequency}x/week`}`;

  const { data: program, error: programError } = await db
    .from('training_programs')
    .insert({
      user_id: input.userId,
      name: programName,
      description: `${input.experience ?? 'intermediate'} · ${input.goal ?? 'general_fitness'} · ${durationWeeks} weeks`,
      duration_weeks: durationWeeks,
      is_active: true,
      metadata: {
        programType: input.programType,
        frequency: input.frequency,
        goal: input.goal,
        experience: input.experience,
        equipment: equipment ?? input.equipment,
        locationId: input.locationId,
        locationName: input.locationName,
        startDate,
        schedule: schedule.map((d) => ({ label: d.label, isRest: d.isRest })),
        customSchedule: input.customSchedule,
      },
    })
    .select('*')
    .single();

  if (programError) throw programError;

  const templateCache = new Map<string, string>();
  let plannedCount = 0;

  for (let week = 1; week <= durationWeeks; week++) {
    const phaseSpec = phaseForWeek(week, durationWeeks);
    const phaseId = await ensurePhaseForWeek(input.userId, program.id, week, durationWeeks, startDate);

    for (const slot of schedule) {
      if (slot.isRest) continue;

      const date = addDays(startDate, (week - 1) * 7 + slot.dayIndex);
      const cacheKey = `${slot.label}-${phaseSpec.sprintPhase}`;

      let templateId = templateCache.get(cacheKey);
      if (!templateId) {
        const plan = await buildAdaptiveWorkoutPlan(
          input.userId,
          slot.muscleGroups,
          `${programTypeLabel(input.programType)} ${slot.label} — ${phaseSpec.sprintPhase}`,
          equipment?.length ? { equipmentOverride: equipment } : undefined,
        );

        let exercises = scaleExercises(plan.exercises, phaseSpec.volumeMultiplier, phaseSpec.repRangeAdjust);
        exercises = applyWeeklyProgression(
          exercises,
          performance,
          phaseSpec.intensityMultiplier,
          recoveryMods.volumeMultiplier,
        );
        exercises = applySubstitutionsToExercises(exercises, limitations as LimitationContext[]);

        const { data: template, error: templateError } = await db
          .from('workout_templates')
          .insert({
            user_id: input.userId,
            name: `${slot.label} (${phaseSpec.sprintPhase})`,
            description: plan.rationale,
            muscle_groups: slot.muscleGroups,
            estimated_duration_minutes: plan.estimatedMinutes,
            exercises,
            is_system: false,
          })
          .select('id')
          .single();

        if (templateError) throw templateError;
        const newTemplateId = template.id;
        templateId = newTemplateId;
        templateCache.set(cacheKey, newTemplateId);
      }

      if (!templateId) continue;

      const { data: templateRow } = await db
        .from('workout_templates')
        .select('exercises, estimated_duration_minutes')
        .eq('id', templateId)
        .single();

      const exercises = (templateRow?.exercises ?? []) as GeneratedWorkoutExercise[];
      const progressed = applyWeeklyProgression(
        exercises,
        performance,
        phaseSpec.intensityMultiplier,
        recoveryMods.volumeMultiplier,
      );

      await db.from('planned_workouts').insert({
        user_id: input.userId,
        template_id: templateId,
        training_phase_id: phaseId,
        name: `${slot.label} — Week ${week}`,
        scheduled_date: date,
        status: 'planned',
        suggested_muscle_groups: slot.muscleGroups,
        ai_rationale: `${dayLabel(slot.dayIndex)} · ${phaseSpec.sprintPhase} phase · ${programTypeLabel(input.programType)}`,
        metadata: {
          programId: program.id,
          weekNumber: week,
          dayIndex: slot.dayIndex,
          dayLabel: dayLabel(slot.dayIndex),
          slotLabel: slot.label,
          sprintPhase: phaseSpec.sprintPhase,
          exercises: progressed,
          plannedVolume: totalPlannedVolume(progressed),
          locationId: input.locationId,
          locationName: input.locationName,
        },
      });

      plannedCount += 1;
    }
  }

  return { program, plannedCount, startDate, schedule };
}

export async function getProgramDashboard(userId: string): Promise<ProgramDashboard | null> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: program } = await db
    .from('training_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!program) return null;

  const startDate = (program.metadata as { startDate?: string })?.startDate ?? program.created_at.slice(0, 10);
  const currentWeek = currentProgramWeek(startDate, today);

  const { data: phase } = await db
    .from('training_phases')
    .select('*')
    .eq('program_id', program.id)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: planned } = await db
    .from('planned_workouts')
    .select('*')
    .eq('user_id', userId)
    .contains('metadata', { programId: program.id })
    .order('scheduled_date', { ascending: true });

  const all = planned ?? [];
  const completed = all.filter((w) => w.status === 'completed').length;
  const totalPlanned = all.length;
  const completionPct = totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0;

  const nextWorkout =
    all.find((w) => w.status === 'planned' && w.scheduled_date >= today) ??
    all.find((w) => w.status === 'planned') ??
    null;

  const upcomingWorkouts = all
    .filter((w) => w.status === 'planned' && w.scheduled_date >= today)
    .slice(0, 7);

  return {
    program,
    phase: phase ?? null,
    currentWeek,
    completionPct,
    nextWorkout,
    upcomingWorkouts,
    totalPlanned,
    totalCompleted: completed,
  };
}

export async function reschedulePlannedWorkout(plannedWorkoutId: string, newDate: string) {
  const db = requireAdmin();
  const { data: existing } = await db.from('planned_workouts').select('scheduled_date, metadata').eq('id', plannedWorkoutId).single();
  if (!existing) throw new Error('Planned workout not found');

  const metadata = {
    ...(existing.metadata as Record<string, unknown>),
    rescheduledFrom: existing.scheduled_date,
    rescheduledAt: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('planned_workouts')
    .update({ scheduled_date: newDate, metadata })
    .eq('id', plannedWorkoutId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getPlannedWorkoutsInRange(userId: string, from: string, to: string) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('planned_workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)
    .order('scheduled_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type { DaySlot, ProgramFrequency, ProgramType };


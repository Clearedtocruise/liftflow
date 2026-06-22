import { applyEquipmentSubstitutionsToExercises } from './equipmentSubstitutionEngine.js';
import { applySubstitutionsToExercises, type LimitationContext } from './exerciseSubstitution.js';
import { applyWeeklyProgression, totalPlannedVolume } from './programProgression.js';
import { inferProgramFrequency, inferProgramType, resolveDaysPerWeekFromProfile } from './programSelection.js';
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
import { resolveRankedGoals } from './trainingGoals.js';
import {
    buildAdaptiveWorkoutPlan,
    getLastPerformanceBySlug,
    loadActiveLimitations,
    loadAvailableExercises,
    loadRecoveryModifiers,
    WORKOUT_MIN_EXERCISES,
    WORKOUT_MIN_SETS,
    WORKOUT_TARGET_EXERCISES,
    type GeneratedWorkoutExercise
} from './workoutPlanner.js';

function enrichExercisesWithSupersetGroups<T extends Record<string, unknown>>(
  exercises: T[],
): Array<T & { supersetGroupId?: string }> {
  if (exercises.length < 2) return exercises;
  const result = exercises.map((exercise) => ({ ...exercise }));
  for (let i = 0; i + 1 < result.length; i += 2) {
    const groupId = `ss-${Math.floor(i / 2) + 1}`;
    result[i] = { ...result[i], supersetGroupId: groupId };
    result[i + 1] = { ...result[i + 1], supersetGroupId: groupId };
  }
  return result;
}

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

/** Bump when workout planning rules change so existing programs can be regenerated. */
export const PLAN_RULES_VERSION = 10;

const MIN_ACCEPTABLE_EXERCISES_PER_SESSION = 8;

type StoredProgramMetadata = {
  programType?: ProgramType;
  frequency?: ProgramFrequency;
  goal?: string;
  experience?: string;
  equipment?: string[];
  locationId?: string;
  locationName?: string;
  customSchedule?: string[];
  planRulesVersion?: number;
  startDate?: string;
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
    sets: Math.max(3, Math.round(ex.sets * volumeMultiplier)),
    reps: repRangeAdjust ?? ex.reps,
  }));
}

function shouldIncludeCore(slot: DaySlot): boolean {
  if (slot.isRest || slot.sessionKind === 'cardio') return false;
  return true;
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
        planRulesVersion: PLAN_RULES_VERSION,
      },
    })
    .select('*')
    .single();

  if (programError) throw programError;

  const templateCache = new Map<string, string>();
  const programRecentSlugs = new Map<string, Date>();
  let plannedCount = 0;

  for (let week = 1; week <= durationWeeks; week++) {
    const phaseSpec = phaseForWeek(week, durationWeeks);
    const phaseId = await ensurePhaseForWeek(input.userId, program.id, week, durationWeeks, startDate);

    for (const slot of schedule) {
      if (slot.isRest) continue;

      const date = addDays(startDate, (week - 1) * 7 + slot.dayIndex);

      if (slot.sessionKind === 'cardio') {
        await db.from('planned_workouts').insert({
          user_id: input.userId,
          training_phase_id: phaseId,
          name: `${slot.label} — Week ${week}`,
          scheduled_date: date,
          status: 'planned',
          suggested_muscle_groups: slot.muscleGroups,
          ai_rationale: `${dayLabel(slot.dayIndex)} · Cardio / HIIT · ${programTypeLabel(input.programType)}`,
          metadata: {
            programId: program.id,
            weekNumber: week,
            dayIndex: slot.dayIndex,
            dayLabel: dayLabel(slot.dayIndex),
            slotLabel: slot.label,
            sprintPhase: phaseSpec.sprintPhase,
            sessionKind: 'cardio',
            cardioType: 'hiit',
            exercises: [],
            locationId: input.locationId,
            locationName: input.locationName,
          },
        });
        plannedCount += 1;
        continue;
      }

      const splitOccurrenceIndex = schedule.filter(
        (day) => !day.isRest && day.label === slot.label && day.dayIndex < slot.dayIndex,
      ).length;

      const cacheKey = `${slot.label}-occ${splitOccurrenceIndex}-${phaseSpec.sprintPhase}-week-${week}`;
      const rotationSeed = (week - 1) * 7 + slot.dayIndex + splitOccurrenceIndex * 100;

      let templateId = templateCache.get(cacheKey);
      if (!templateId) {
        const plan = await buildAdaptiveWorkoutPlan(
          input.userId,
          slot.muscleGroups,
          `${programTypeLabel(input.programType)} ${slot.label} — ${phaseSpec.sprintPhase}`,
          {
            ...(equipment?.length ? { equipmentOverride: equipment } : {}),
            includeCore: shouldIncludeCore(slot),
            targetExerciseCount: WORKOUT_TARGET_EXERCISES,
            minimumExercises: WORKOUT_MIN_EXERCISES,
            minimumSets: WORKOUT_MIN_SETS,
            programRecentSlugs,
            rotationSeed,
            splitOccurrenceIndex,
            slotLabel: slot.label,
          },
        );

        let exercises = scaleExercises(plan.exercises, phaseSpec.volumeMultiplier, phaseSpec.repRangeAdjust);
        if (equipment?.length) {
          const exercisePool = await loadAvailableExercises(input.userId, equipment);
          const swapped = applyEquipmentSubstitutionsToExercises(exercises, equipment, exercisePool);
          exercises = swapped.exercises;
        }
        exercises = applyWeeklyProgression(
          exercises,
          performance,
          phaseSpec.intensityMultiplier,
          recoveryMods.volumeMultiplier,
        );
        exercises = applySubstitutionsToExercises(exercises, limitations as LimitationContext[]);
        exercises = enrichExercisesWithSupersetGroups(exercises);

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
      const progressed = enrichExercisesWithSupersetGroups(
        applyWeeklyProgression(
          exercises,
          performance,
          phaseSpec.intensityMultiplier,
          recoveryMods.volumeMultiplier,
        ),
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

async function buildProgramInputFromProfile(userId: string): Promise<CreateProgramInput> {
  const db = requireAdmin();
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) throw new Error('Profile not found');

  const { data: activeProgram } = await db
    .from('training_programs')
    .select('metadata')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  const profileMetadata = (profile.metadata ?? {}) as {
    coachProfile?: { daysPerWeek?: number; timeline?: string };
    coachActivation?: { frequency?: number };
  };
  const coachProfile = profileMetadata.coachProfile ?? {};
  const programMeta = (activeProgram?.metadata ?? {}) as StoredProgramMetadata;
  const rankedGoals = resolveRankedGoals(profile.fitness_goals, profile.primary_training_goal);
  const primaryGoal = rankedGoals[0];
  const daysPerWeek = resolveDaysPerWeekFromProfile({
    coachProfileDays: coachProfile.daysPerWeek,
    programFrequency: typeof programMeta.frequency === 'number' ? programMeta.frequency : undefined,
    coachActivationFrequency: profileMetadata.coachActivation?.frequency,
  });

  return {
    userId,
    programType: inferProgramType({
      fitnessGoals: rankedGoals,
      primaryGoal,
      experience: profile.training_experience ?? undefined,
      daysPerWeek,
      timeline: coachProfile.timeline as 'aggressive' | 'moderate' | 'conservative' | undefined,
    }),
    frequency: inferProgramFrequency({
      daysPerWeek,
      fitnessGoals: rankedGoals,
      primaryGoal,
    }),
    goal: primaryGoal,
    experience: profile.training_experience ?? 'intermediate',
    durationWeeks: 12,
    equipment: profile.available_equipment ?? undefined,
  };
}

export async function regenerateActiveProgram(userId: string, options?: { force?: boolean }) {
  const db = requireAdmin();
  const { data: program } = await db
    .from('training_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (program) {
    const meta = (program.metadata ?? {}) as StoredProgramMetadata;
    if (!options?.force && meta.planRulesVersion === PLAN_RULES_VERSION) {
      return { regenerated: false as const, reason: 'already_current' as const, program, plannedCount: 0 };
    }

    const profileInput = await buildProgramInputFromProfile(userId);

    const input: CreateProgramInput = {
      userId,
      programType: profileInput.programType,
      frequency: profileInput.frequency,
      goal: profileInput.goal ?? meta.goal,
      experience: profileInput.experience ?? meta.experience,
      durationWeeks: program.duration_weeks ?? 12,
      equipment: profileInput.equipment ?? meta.equipment,
      locationId: meta.locationId,
      locationName: meta.locationName,
      customSchedule: meta.customSchedule,
    };

    const result = await generateTrainingProgram(input);
    return { regenerated: true as const, ...result };
  }

  const input = await buildProgramInputFromProfile(userId);
  const result = await generateTrainingProgram(input);
  return { regenerated: true as const, ...result };
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
  return dedupePlannedRowsByDate(data ?? []);
}

const PLANNED_ROW_STATUS_RANK: Record<string, number> = {
  planned: 3,
  in_progress: 2,
  completed: 1,
  cancelled: 0,
};

/** Keep one row per scheduled_date when duplicate planner rows exist. */
function dedupePlannedRowsByDate(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const byDate = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const date = String(row.scheduled_date ?? '');
    if (!date) continue;
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, row);
      continue;
    }

    const existingRank = PLANNED_ROW_STATUS_RANK[String(existing.status)] ?? 0;
    const nextRank = PLANNED_ROW_STATUS_RANK[String(row.status)] ?? 0;
    if (nextRank > existingRank) {
      byDate.set(date, row);
      continue;
    }
    if (nextRank < existingRank) continue;

    const existingExercises = ((existing.metadata as { exercises?: unknown[] })?.exercises ?? []).length;
    const nextExercises = ((row.metadata as { exercises?: unknown[] })?.exercises ?? []).length;
    if (nextExercises > existingExercises) {
      byDate.set(date, row);
    }
  }

  return [...byDate.values()].sort((a, b) =>
    String(a.scheduled_date).localeCompare(String(b.scheduled_date)),
  );
}

function plannedWorkoutExerciseCount(workout: Record<string, unknown>): number {
  const meta = (workout.metadata ?? {}) as { sessionKind?: string; exercises?: unknown[] };
  if (meta.sessionKind === 'cardio') return WORKOUT_TARGET_EXERCISES;
  return meta.exercises?.length ?? 0;
}

export function weekPlansNeedExerciseRefresh(
  workouts: Record<string, unknown>[],
): boolean {
  return workouts.some((workout) => {
    if (workout.status !== 'planned') return false;
    const count = plannedWorkoutExerciseCount(workout);
    return count > 0 && count < MIN_ACCEPTABLE_EXERCISES_PER_SESSION;
  });
}

export async function getPlannedWorkoutsInRangeWithRefresh(userId: string, from: string, to: string) {
  let workouts = await getPlannedWorkoutsInRange(userId, from, to);
  if (weekPlansNeedExerciseRefresh(workouts)) {
    await regenerateActiveProgram(userId, { force: true });
    workouts = await getPlannedWorkoutsInRange(userId, from, to);
  }
  return workouts;
}

export type { DaySlot, ProgramFrequency, ProgramType };


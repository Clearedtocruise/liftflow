import { applyEquipmentSubstitutionsToExercises } from './equipmentSubstitutionEngine.js';
import { applySubstitutionsToExercises, type LimitationContext } from './exerciseSubstitution.js';
import {
    buildReferenceStyleWorkoutPlan,
    enrichWithSmartSupersetGroups,
    shouldUseReferenceLiftingProgram,
} from './liftingReference/index.js';
import { applyWeeklyProgression, totalPlannedVolume } from './programProgression.js';
import { inferProgramFrequency, inferProgramType, resolveDaysPerWeekFromProfile } from './programSelection.js';
import {
    addDays,
    buildWeeklySchedule,
    countLiftSlotsInSchedule,
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
  return enrichWithSmartSupersetGroups(exercises) as Array<T & { supersetGroupId?: string }>;
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
  /** Preserve timeline across regenerations. Only omit / restart for true first create or explicit restart. */
  startDate?: string;
  restartProgram?: boolean;
};

/** Bump when workout planning rules change so existing programs can be regenerated. */
export const PLAN_RULES_VERSION = 18;

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
  schedule?: Array<{ label?: string; isRest?: boolean }>;
};

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T12:00:00').getTime();
  const to = new Date(toDate + 'T12:00:00').getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * If startDate was recently reset but the user has months of completed history,
 * restore the program clock from the earliest completed session / planned workout.
 */
export async function resolveProgramStartDateFromHistory(
  userId: string,
  currentStartDate: string | undefined,
  options?: { force?: boolean },
): Promise<{ startDate: string; repaired: boolean }> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const current = weekStartFromDate(currentStartDate ?? today);

  const [{ data: earliestCompleted }, { data: earliestSession }] = await Promise.all([
    db
      .from('planned_workouts')
      .select('scheduled_date')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('workout_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const candidates: string[] = [];
  if (earliestCompleted?.scheduled_date) candidates.push(String(earliestCompleted.scheduled_date));
  if (earliestSession?.started_at) candidates.push(String(earliestSession.started_at).slice(0, 10));

  if (candidates.length === 0) {
    return { startDate: current, repaired: false };
  }

  candidates.sort();
  const historyStart = weekStartFromDate(candidates[0]!);
  if (historyStart >= current) {
    return { startDate: current, repaired: false };
  }

  const historySpanDays = daysBetween(historyStart, today);
  const currentAgeDays = daysBetween(current, today);
  const shouldRepair = options?.force
    ? true
    : historySpanDays >= 28 && currentAgeDays <= 21;

  if (!shouldRepair) {
    return { startDate: current, repaired: false };
  }

  return { startDate: historyStart, repaired: true };
}

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

  const { data: existingActive } = await db
    .from('training_programs')
    .select('id, created_at, metadata, duration_weeks')
    .eq('user_id', input.userId)
    .eq('is_active', true)
    .maybeSingle();

  const existingMeta = (existingActive?.metadata ?? {}) as StoredProgramMetadata;
  const rawStart = input.restartProgram
    ? undefined
    : (input.startDate ?? existingMeta.startDate ?? existingActive?.created_at?.slice(0, 10));
  const startDate = weekStartFromDate(rawStart ?? new Date().toISOString().slice(0, 10));

  // Keep timeline continuous: if the user is past the original block, extend weeks so
  // the current calendar week still gets planned workouts (avoids empty-week → Week 1 loop).
  let durationWeeks = input.durationWeeks ?? existingActive?.duration_weeks ?? 12;
  const elapsedWeek = currentProgramWeek(startDate);
  if (elapsedWeek > durationWeeks) {
    durationWeeks = elapsedWeek + 4;
  }
  const schedule = buildWeeklySchedule(input.programType, input.frequency, input.customSchedule);
  const limitations = await loadActiveLimitations(input.userId);
  const performance = await getLastPerformanceBySlug(input.userId);
  const recoveryMods = await loadRecoveryModifiers(input.userId);
  const equipment = await resolveProgramEquipment(input.userId, input);

  // Never cancel existing planned workouts until the new week is inserted.
  // Cancel-first left athletes with empty weeks when generation timed out.
  const cancelFrom = weekStartFromDate(new Date().toISOString().slice(0, 10));
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

  await db
    .from('training_programs')
    .update({ is_active: false })
    .eq('user_id', input.userId)
    .neq('id', program.id);

  const templateCache = new Map<string, string>();
  const programRecentSlugs = new Map<string, Date>();
  const insertedPlannedIds: string[] = [];
  let plannedCount = 0;
  // Current calendar week only. Building 3 weeks × 7 lift days was timing out the
  // app's 60s rebuild (Render free tier). Next weeks fill in on later opens/regen.
  const WEEKS_AHEAD = 0;
  const firstWeekToGenerate = Math.max(1, Math.min(elapsedWeek, durationWeeks));
  const lastWeekToGenerate = Math.min(durationWeeks, firstWeekToGenerate + WEEKS_AHEAD);
  const cancelTo = addDays(startDate, lastWeekToGenerate * 7 - 1);

  for (let week = firstWeekToGenerate; week <= lastWeekToGenerate; week++) {
    const phaseSpec = phaseForWeek(week, durationWeeks);
    const phaseId = await ensurePhaseForWeek(input.userId, program.id, week, durationWeeks, startDate);

    for (const slot of schedule) {
      if (slot.isRest) continue;

      const date = addDays(startDate, (week - 1) * 7 + slot.dayIndex);

      if (slot.sessionKind === 'cardio') {
        const { data: cardioRow } = await db
          .from('planned_workouts')
          .insert({
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
          })
          .select('id')
          .single();
        if (cardioRow?.id) insertedPlannedIds.push(cardioRow.id);
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
        const useReferenceLifting =
          shouldUseReferenceLiftingProgram(input.programType, input.frequency) &&
          slot.dayIndex <= 5;

        const referencePlan = useReferenceLifting
          ? await buildReferenceStyleWorkoutPlan(input.userId, slot.muscleGroups, {
              ...(equipment?.length ? { equipmentOverride: equipment } : {}),
              weekNumber: week,
              dayIndex: slot.dayIndex,
              slotLabel: slot.label,
              rotationSeed,
              splitOccurrenceIndex,
              rationalePrefix: `${dayLabel(slot.dayIndex)} · ${week <= 4 ? 'Month 1' : 'Reference program'}`,
            })
          : null;

        const plan =
          referencePlan ??
          (await buildAdaptiveWorkoutPlan(
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
          ));

        let exercises = referencePlan
          ? plan.exercises
          : scaleExercises(plan.exercises, phaseSpec.volumeMultiplier, phaseSpec.repRangeAdjust);
        if (equipment?.length && !referencePlan) {
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
        exercises = referencePlan
          ? exercises
          : enrichExercisesWithSupersetGroups(exercises);

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
      const isMonth1Reference = exercises.some((exercise) => exercise.notes?.includes('Block '));
      const progressed = isMonth1Reference
        ? exercises
        : enrichExercisesWithSupersetGroups(
            applyWeeklyProgression(
              exercises,
              performance,
              phaseSpec.intensityMultiplier,
              recoveryMods.volumeMultiplier,
            ),
          );

      const { data: plannedRow } = await db
        .from('planned_workouts')
        .insert({
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
        })
        .select('id')
        .single();
      if (plannedRow?.id) insertedPlannedIds.push(plannedRow.id);

      plannedCount += 1;
    }
  }

  const expectedLiftSlots = schedule.filter((slot) => !slot.isRest).length;
  if (expectedLiftSlots > 0 && insertedPlannedIds.length === 0) {
    // Roll back the empty program shell so the prior active week stays usable.
    await db.from('training_programs').update({ is_active: false }).eq('id', program.id);
    if (existingActive?.id) {
      await db.from('training_programs').update({ is_active: true }).eq('id', existingActive.id);
    }
    throw new Error('Program rebuild created no workouts — kept your existing week. Retry in a moment.');
  }

  // Supersede old planned rows only after the new week exists.
  // Always cover the visible calendar week so a timezone/startDate skew can't leave a stale 3-day week.
  const calendarWeekEnd = addDays(cancelFrom, 6);
  const effectiveCancelTo = cancelTo > calendarWeekEnd ? cancelTo : calendarWeekEnd;
  if (insertedPlannedIds.length > 0) {
    const { data: stale } = await db
      .from('planned_workouts')
      .select('id')
      .eq('user_id', input.userId)
      .eq('status', 'planned')
      .gte('scheduled_date', cancelFrom)
      .lte('scheduled_date', effectiveCancelTo);
    const staleIds = (stale ?? [])
      .map((row) => row.id as string)
      .filter((id) => !insertedPlannedIds.includes(id));
    if (staleIds.length > 0) {
      await db.from('planned_workouts').update({ status: 'cancelled' }).in('id', staleIds);
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

export async function regenerateActiveProgram(
  userId: string,
  options?: { force?: boolean; repairFromHistory?: boolean },
) {
  const db = requireAdmin();
  const { data: program } = await db
    .from('training_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (program) {
    const meta = (program.metadata ?? {}) as StoredProgramMetadata;
    const profileInput = await buildProgramInputFromProfile(userId);
    const expectedFrequency = profileInput.frequency;
    const storedFrequency =
      typeof meta.frequency === 'number' && meta.frequency >= 3 && meta.frequency <= 7
        ? meta.frequency
        : null;
    const scheduleLiftDays = Array.isArray(meta.schedule)
      ? countLiftSlotsInSchedule(meta.schedule)
      : null;
    // Prefer stored frequency mismatch; schedule count is a backup when frequency is missing/wrong.
    // Also treat a stale template schedule (e.g. still 3 lift slots after user set 6 days) as mismatch.
    const frequencyMismatch =
      expectedFrequency !== 'custom' &&
      ((storedFrequency != null && storedFrequency !== expectedFrequency) ||
        (scheduleLiftDays != null && scheduleLiftDays !== expectedFrequency));

    // Visible calendar week can lag metadata after a failed rebuild (preference 6, still 3 lift days).
    // Count planned + completed so mid-week progress does not look like an under-built week.
    const calendarWeekStart = weekStartFromDate(new Date().toISOString().slice(0, 10));
    const calendarWeekEnd = addDays(calendarWeekStart, 6);
    const { data: calendarWeekRows } = await db
      .from('planned_workouts')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['planned', 'completed', 'skipped'])
      .gte('scheduled_date', calendarWeekStart)
      .lte('scheduled_date', calendarWeekEnd);
    const calendarLiftDays = calendarWeekRows?.length ?? 0;
    const calendarFrequencyMismatch =
      expectedFrequency !== 'custom' &&
      typeof expectedFrequency === 'number' &&
      calendarLiftDays < expectedFrequency;

    if (
      !options?.force &&
      !options?.repairFromHistory &&
      !frequencyMismatch &&
      !calendarFrequencyMismatch &&
      meta.planRulesVersion === PLAN_RULES_VERSION
    ) {
      return { regenerated: false as const, reason: 'already_current' as const, program, plannedCount: 0 };
    }

    // Preserve the program clock unless explicitly repairing from history.
    // Routine regenerations must NOT reset athletes back to Week 1.
    const resolvedStart = options?.repairFromHistory
      ? await resolveProgramStartDateFromHistory(userId, meta.startDate, { force: true })
      : {
          startDate: weekStartFromDate(meta.startDate ?? program.created_at.slice(0, 10)),
          repaired: false,
        };

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
      // Drop a stale custom week when frequency no longer matches — rebuild from pattern.
      customSchedule: frequencyMismatch ? undefined : meta.customSchedule,
      startDate: resolvedStart.startDate,
      restartProgram: false,
    };

    const result = await generateTrainingProgram(input);
    return {
      regenerated: true as const,
      startDateRepaired: resolvedStart.repaired,
      ...result,
    };
  }

  const input = await buildProgramInputFromProfile(userId);
  const result = await generateTrainingProgram({ ...input, restartProgram: true });
  return { regenerated: true as const, startDateRepaired: false, ...result };
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

export async function reschedulePlannedWorkout(plannedWorkoutId: string, newDate: string, ownerUserId?: string) {
  const db = requireAdmin();
  const { data: existing } = await db
    .from('planned_workouts')
    .select('scheduled_date, name, metadata, user_id')
    .eq('id', plannedWorkoutId)
    .single();
  if (!existing) throw new Error('Planned workout not found');
  if (ownerUserId && existing.user_id !== ownerUserId) throw new Error('Planned workout not found');

  const prevMeta = (existing.metadata ?? {}) as Record<string, unknown>;
  let weekNumber =
    typeof prevMeta.weekNumber === 'number' ? (prevMeta.weekNumber as number) : undefined;

  const { data: program } = await db
    .from('training_programs')
    .select('metadata, created_at')
    .eq('user_id', existing.user_id)
    .eq('is_active', true)
    .maybeSingle();
  const startDate =
    (program?.metadata as { startDate?: string } | null)?.startDate ??
    program?.created_at?.slice(0, 10);
  if (startDate) {
    weekNumber = currentProgramWeek(startDate, newDate);
  }

  const slotLabel =
    (typeof prevMeta.slotLabel === 'string' && prevMeta.slotLabel) ||
    String(existing.name ?? 'Workout').replace(/\s*—\s*Week\s*\d+\s*$/i, '').trim();
  const nextName = weekNumber != null ? `${slotLabel} — Week ${weekNumber}` : existing.name;

  const metadata = {
    ...prevMeta,
    rescheduledFrom: existing.scheduled_date,
    rescheduledAt: new Date().toISOString(),
    ...(weekNumber != null ? { weekNumber } : null),
    ...(slotLabel ? { slotLabel } : null),
  };

  const { data, error } = await db
    .from('planned_workouts')
    .update({ scheduled_date: newDate, name: nextName, metadata })
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
function isPreferredPlannedRow(candidate: Record<string, unknown>, incumbent: Record<string, unknown>): boolean {
  const candidateMeta = (candidate.metadata ?? {}) as { rescheduledAt?: string };
  const incumbentMeta = (incumbent.metadata ?? {}) as { rescheduledAt?: string };
  const candidateRescheduled = candidateMeta.rescheduledAt ?? '';
  const incumbentRescheduled = incumbentMeta.rescheduledAt ?? '';
  if (candidateRescheduled !== incumbentRescheduled) {
    if (candidateRescheduled && !incumbentRescheduled) return true;
    if (!candidateRescheduled && incumbentRescheduled) return false;
    return candidateRescheduled > incumbentRescheduled;
  }

  const candidateCreated = String(candidate.created_at ?? '');
  const incumbentCreated = String(incumbent.created_at ?? '');
  if (candidateCreated !== incumbentCreated) {
    return candidateCreated > incumbentCreated;
  }

  const candidateExercises = ((candidate.metadata as { exercises?: unknown[] })?.exercises ?? []).length;
  const incumbentExercises = ((incumbent.metadata as { exercises?: unknown[] })?.exercises ?? []).length;
  return candidateExercises > incumbentExercises;
}

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

    if (isPreferredPlannedRow(row, existing)) {
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
  // Never force-regenerate on a read path. Thin exercise counts used to trigger
  // regenerateActiveProgram here, which cancelled the IDs the Workout tab was
  // displaying — every day tap then showed "Workout not found".
  return getPlannedWorkoutsInRange(userId, from, to);
}

export type { DaySlot, ProgramFrequency, ProgramType };


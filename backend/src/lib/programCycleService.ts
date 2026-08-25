/**
 * DB glue for the custom day-based program cycle.
 *
 * Reuses the existing tables so the rest of the app keeps working unchanged:
 *   - The cycle TEMPLATE lives in `training_programs.metadata.cycle` (planPack = 'custom_cycle').
 *   - The active day is MATERIALIZED as a normal `planned_workouts` row for the local date, so
 *     ActiveWorkoutScreen, session start, history and previous-performance all flow as before.
 *   - Completed workouts stay in `workout_sessions` — never deleted or overwritten when the cycle
 *     loops back to Day 1.
 *
 * The pure loop math lives in `programCycle.ts`; this file only reads/writes Supabase.
 */

import { localDateString } from './localDate.js';
import { totalPlannedVolume } from './programProgression.js';
import {
  completeCurrentCycleDay,
  currentCycleDay,
  isRestDay,
  normalizeCycle,
  reconcileCycleForDate,
  CUSTOM_CYCLE_PLAN_PACK,
  type CycleDay,
  type CycleTemplateExercise,
  type ProgramCycle,
} from './programCycle.js';
import { requireAdmin } from './supabase.js';

type Db = ReturnType<typeof requireAdmin>;

export type CycleProgramInput = {
  name?: string;
  lengthDays: number;
  days: Array<{ label?: string; isRest?: boolean; exercises?: CycleTemplateExercise[] }>;
};

export type CycleStatus = {
  programId: string;
  cycle: ProgramCycle;
  activeDayNumber: number;
  activeDay: CycleDay | undefined;
  today: string;
};

function addIsoDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function muscleGroupsForDay(day: CycleDay): string[] {
  const groups = new Set<string>();
  for (const exercise of day.exercises) {
    const name = (exercise.name ?? '').toLowerCase();
    if (/bench|chest|press|push|dip|fly/.test(name)) groups.add('chest');
    if (/row|pull|lat|back|deadlift|shrug/.test(name)) groups.add('back');
    if (/squat|leg|lunge|calf|hamstring|glute/.test(name)) groups.add('legs');
    if (/curl|bicep/.test(name)) groups.add('biceps');
    if (/tricep|extension|skull/.test(name)) groups.add('triceps');
    if (/shoulder|delt|overhead|lateral raise/.test(name)) groups.add('shoulders');
    if (/plank|ab|core|crunch|sit-up|leg raise/.test(name)) groups.add('core');
  }
  return [...groups];
}

async function loadActiveProgramRow(db: Db, userId: string) {
  const { data } = await db
    .from('training_programs')
    .select('id, metadata, duration_weeks, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data ?? null;
}

function cycleFromMetadata(metadata: unknown): ProgramCycle | null {
  const meta = (metadata ?? {}) as { planPack?: string; cycle?: unknown };
  if (meta.planPack !== CUSTOM_CYCLE_PLAN_PACK || !meta.cycle) return null;
  return normalizeCycle(meta.cycle as Parameters<typeof normalizeCycle>[0]);
}

/** Cancel any not-yet-started custom-cycle planned rows for a date so re-materialization is idempotent. */
async function clearMaterializedCycleDay(db: Db, userId: string, date: string): Promise<void> {
  await db
    .from('planned_workouts')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'planned')
    .eq('scheduled_date', date)
    .contains('metadata', { planPack: CUSTOM_CYCLE_PLAN_PACK });
}

/**
 * Materialize one cycle day as today's (or a given date's) planned workout. Rest days clear any
 * startable row and insert nothing — a rest day shows as "no workout" in the existing week UI.
 */
async function materializeCycleDay(
  db: Db,
  userId: string,
  programId: string,
  cycle: ProgramCycle,
  dayNumber: number,
  date: string,
): Promise<string | null> {
  await clearMaterializedCycleDay(db, userId, date);

  const day = cycle.days.find((d) => d.dayNumber === dayNumber);
  if (!day || isRestDay(day) || day.exercises.length === 0) {
    return null;
  }

  const exercises = day.exercises.map((exercise) => ({
    name: exercise.name,
    exerciseName: exercise.name,
    sets: exercise.sets,
    reps: exercise.repRange ?? exercise.reps ?? '8-10',
    repRange: exercise.repRange ?? exercise.reps ?? '8-10',
    restSeconds: exercise.restSeconds ?? 90,
    weightLbs: exercise.weightLbs,
    notes: exercise.notes,
    executionMode: exercise.executionMode,
  }));
  const muscleGroups = muscleGroupsForDay(day);

  const { data: template, error: templateError } = await db
    .from('workout_templates')
    .insert({
      user_id: userId,
      name: day.label,
      description: `Custom program · ${day.label}`,
      muscle_groups: muscleGroups,
      estimated_duration_minutes: Math.max(30, exercises.length * 8),
      exercises,
      is_system: false,
    })
    .select('id')
    .single();
  if (templateError) throw templateError;

  const { data: planned, error: plannedError } = await db
    .from('planned_workouts')
    .insert({
      user_id: userId,
      template_id: template.id,
      name: `${day.label} — Day ${dayNumber}`,
      scheduled_date: date,
      status: 'planned',
      suggested_muscle_groups: muscleGroups,
      ai_rationale: `Custom program · Day ${dayNumber} of ${cycle.lengthDays}`,
      metadata: {
        programId,
        planPack: CUSTOM_CYCLE_PLAN_PACK,
        cycleDay: dayNumber,
        cycleVersion: cycle.version,
        dayLabel: day.label,
        exercises,
        plannedVolume: totalPlannedVolume(
          exercises.map((e) => ({ sets: e.sets, reps: e.reps, weightLbs: e.weightLbs })),
        ),
      },
    })
    .select('id')
    .single();
  if (plannedError) throw plannedError;
  return planned.id;
}

async function persistCycle(db: Db, programId: string, userId: string, cycle: ProgramCycle): Promise<void> {
  const { data: current } = await db.from('training_programs').select('metadata').eq('id', programId).maybeSingle();
  const metadata = { ...((current?.metadata ?? {}) as Record<string, unknown>), planPack: CUSTOM_CYCLE_PLAN_PACK, cycle };
  await db.from('training_programs').update({ metadata }).eq('id', programId).eq('user_id', userId);
}

/** Create (or replace) the user's active program with a day-based cycle and materialize Day 1 for today. */
export async function createOrReplaceCycle(
  userId: string,
  input: CycleProgramInput,
  timeZone?: string | null,
): Promise<CycleStatus> {
  const db = requireAdmin();
  const today = localDateString(new Date(), timeZone);

  const cycle = normalizeCycle({
    version: 1,
    lengthDays: input.lengthDays,
    currentDay: 1,
    anchorDate: today,
    name: input.name,
    days: input.days,
  });

  // Deactivate any existing programs (calendar or a prior cycle) — one active program at a time.
  await db.from('training_programs').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

  const { data: program, error: programError } = await db
    .from('training_programs')
    .insert({
      user_id: userId,
      name: cycle.name ?? 'Custom Program',
      description: `Custom ${cycle.lengthDays}-day cycle`,
      duration_weeks: null,
      is_active: true,
      metadata: {
        planPack: CUSTOM_CYCLE_PLAN_PACK,
        programType: 'custom_cycle',
        startDate: today,
        planRulesVersion: 'custom-cycle-1',
        cycle,
      },
    })
    .select('id')
    .single();
  if (programError || !program) throw programError ?? new Error('Failed to create custom program');

  // Mark the profile self-directed enough that the calendar week engine will not overwrite the cycle.
  const { data: profile } = await db.from('profiles').select('metadata').eq('id', userId).maybeSingle();
  const existingMeta = (profile?.metadata ?? {}) as Record<string, unknown>;
  const coachProfile = { ...((existingMeta.coachProfile as Record<string, unknown>) ?? {}), planPack: CUSTOM_CYCLE_PLAN_PACK };
  await db.from('profiles').update({ metadata: { ...existingMeta, coachProfile } }).eq('id', userId);

  // Clear any leftover calendar-week planned rows around today so the cycle day is what shows.
  await db
    .from('planned_workouts')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'planned')
    .gte('scheduled_date', today)
    .lte('scheduled_date', addIsoDays(today, 6));

  await materializeCycleDay(db, userId, program.id, cycle, cycle.currentDay, today);

  return { programId: program.id, cycle, activeDayNumber: cycle.currentDay, activeDay: currentCycleDay(cycle), today };
}

/**
 * Edit the active cycle template. Changes affect FUTURE workouts only: the current-day pointer is
 * preserved and completed sessions are never touched. Today's not-yet-started planned row is
 * refreshed so an edit to the current day is reflected before the user starts it.
 */
export async function updateActiveCycleTemplate(
  userId: string,
  edit: { name?: string; lengthDays?: number; days: CycleProgramInput['days'] },
  timeZone?: string | null,
): Promise<CycleStatus> {
  const db = requireAdmin();
  const today = localDateString(new Date(), timeZone);
  const program = await loadActiveProgramRow(db, userId);
  const existing = program ? cycleFromMetadata(program.metadata) : null;
  if (!program || !existing) throw new Error('No active custom program to edit');

  const nextCycle = normalizeCycle({
    version: existing.version + 1,
    lengthDays: edit.lengthDays ?? edit.days.length,
    currentDay: existing.currentDay,
    anchorDate: existing.anchorDate ?? today,
    name: edit.name ?? existing.name,
    days: edit.days,
  });

  await persistCycle(db, program.id, userId, nextCycle);

  // Refresh today's slot only if it has not been started/completed yet (status still 'planned').
  const { data: todaysRows } = await db
    .from('planned_workouts')
    .select('id, status')
    .eq('user_id', userId)
    .eq('scheduled_date', today)
    .contains('metadata', { planPack: CUSTOM_CYCLE_PLAN_PACK });
  const startedToday = (todaysRows ?? []).some((row) => row.status !== 'planned');
  if (!startedToday) {
    await materializeCycleDay(db, userId, program.id, nextCycle, nextCycle.currentDay, today);
  }

  return {
    programId: program.id,
    cycle: nextCycle,
    activeDayNumber: nextCycle.currentDay,
    activeDay: currentCycleDay(nextCycle),
    today,
  };
}

export async function getCycleStatus(userId: string, timeZone?: string | null): Promise<CycleStatus | null> {
  const db = requireAdmin();
  const program = await loadActiveProgramRow(db, userId);
  const cycle = program ? cycleFromMetadata(program.metadata) : null;
  if (!program || !cycle) return null;
  const today = localDateString(new Date(), timeZone);
  return { programId: program.id, cycle, activeDayNumber: cycle.currentDay, activeDay: currentCycleDay(cycle), today };
}

/**
 * Reconcile the cycle with the calendar and make sure today's active day is materialized.
 * Rest days that have elapsed advance the pointer automatically; a workout day waits for completion.
 * Safe to call on every load / day rollover — idempotent per date.
 */
export async function ensureCycleMaterialized(userId: string, timeZone?: string | null): Promise<CycleStatus | null> {
  const db = requireAdmin();
  const program = await loadActiveProgramRow(db, userId);
  const cycle = program ? cycleFromMetadata(program.metadata) : null;
  if (!program || !cycle) return null;

  const today = localDateString(new Date(), timeZone);
  const { cycle: reconciled, advanced } = reconcileCycleForDate(cycle, today);

  if (advanced || reconciled.anchorDate !== cycle.anchorDate) {
    await persistCycle(db, program.id, userId, reconciled);
  }

  // Is today already represented (planned or already completed)? If not, materialize the active day.
  const { data: todaysRows } = await db
    .from('planned_workouts')
    .select('id, status')
    .eq('user_id', userId)
    .eq('scheduled_date', today)
    .contains('metadata', { planPack: CUSTOM_CYCLE_PLAN_PACK });
  const hasToday = (todaysRows ?? []).some((row) => row.status === 'planned' || row.status === 'completed' || row.status === 'active');
  const activeDay = reconciled.days.find((d) => d.dayNumber === reconciled.currentDay);
  if (!hasToday && activeDay && !isRestDay(activeDay)) {
    await materializeCycleDay(db, userId, program.id, reconciled, reconciled.currentDay, today);
  }

  return {
    programId: program.id,
    cycle: reconciled,
    activeDayNumber: reconciled.currentDay,
    activeDay,
    today,
  };
}

/**
 * Advance the cycle after a workout completes. Only advances when the completed planned workout is
 * the current cycle day, so double-taps or completing a stale row cannot skip days. Materializes the
 * next day for the next calendar date and loops Day N → Day 1.
 */
export async function advanceCycleAfterCompletion(
  userId: string,
  completedPlannedWorkoutId: string | null | undefined,
  timeZone?: string | null,
): Promise<CycleStatus | null> {
  const db = requireAdmin();
  const program = await loadActiveProgramRow(db, userId);
  const cycle = program ? cycleFromMetadata(program.metadata) : null;
  if (!program || !cycle) return null;

  const today = localDateString(new Date(), timeZone);

  // Guard: only advance for a genuine current-cycle-day completion.
  if (completedPlannedWorkoutId) {
    const { data: completedRow } = await db
      .from('planned_workouts')
      .select('metadata, status')
      .eq('id', completedPlannedWorkoutId)
      .eq('user_id', userId)
      .maybeSingle();
    const meta = (completedRow?.metadata ?? {}) as { planPack?: string; cycleDay?: number };
    if (meta.planPack !== CUSTOM_CYCLE_PLAN_PACK) return getCycleStatus(userId, timeZone);
    if (typeof meta.cycleDay === 'number' && meta.cycleDay !== cycle.currentDay) {
      // A stale/older day completed — do not move the live pointer.
      return getCycleStatus(userId, timeZone);
    }
  }

  const nextDate = addIsoDays(today, 1);
  const advanced = completeCurrentCycleDay(cycle, { anchorDate: nextDate });
  await persistCycle(db, program.id, userId, advanced);

  // Pre-materialize the next day so the upcoming session is ready.
  await materializeCycleDay(db, userId, program.id, advanced, advanced.currentDay, nextDate);

  return {
    programId: program.id,
    cycle: advanced,
    activeDayNumber: advanced.currentDay,
    activeDay: currentCycleDay(advanced),
    today,
  };
}

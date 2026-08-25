/**
 * Day-based custom program cycle (ONE MORE "Basic" feature).
 *
 * A cycle is a rotation of Day 1..N (1–30 days) that loops back to Day 1 after the final day —
 * NOT a Monday–Sunday calendar week. Each day is a workout day or a rest day. The cycle template
 * lives in `training_programs.metadata.cycle`; completed workouts stay in `workout_sessions`, so
 * editing the template never rewrites history and looping never deletes a previous cycle's data.
 *
 * These are pure functions (no dates, no DB) so the loop math, rest-day handling, rollover to
 * Day 1, and template-edit-preserves-pointer behaviour can be reasoned about and unit-tested.
 */

import type { TemplateExercise } from '@/types/training';

export const CYCLE_MIN_DAYS = 1;
export const CYCLE_MAX_DAYS = 30;
export const CUSTOM_CYCLE_PLAN_PACK = 'custom_cycle';

export type CycleDay = {
  /** 1-based position within the cycle (Day 1, Day 2, …). */
  dayNumber: number;
  isRest: boolean;
  label: string;
  /** Reused plan-exercise shape so materialized workouts feed the existing session pipeline. */
  exercises: TemplateExercise[];
};

export type ProgramCycle = {
  /** Bumped on every template edit so clients can detect a changed template. */
  version: number;
  /** 1–30. */
  lengthDays: number;
  /** The day that is "up next" — survives restarts because it is persisted server-side. */
  currentDay: number;
  /** ISO date (YYYY-MM-DD) the current day is scheduled for; used to reconcile on calendar rollover. */
  anchorDate?: string;
  days: CycleDay[];
  name?: string;
};

export function clampCycleLength(length: number): number {
  if (!Number.isFinite(length)) return CYCLE_MIN_DAYS;
  return Math.min(CYCLE_MAX_DAYS, Math.max(CYCLE_MIN_DAYS, Math.round(length)));
}

/**
 * Wrap any integer into the 1..lengthDays range. Day N+1 becomes Day 1; Day 0 becomes Day N.
 * This is what makes the cycle loop.
 */
export function normalizeCurrentDay(day: number, lengthDays: number): number {
  const length = clampCycleLength(lengthDays);
  if (!Number.isFinite(day)) return 1;
  const zeroBased = (Math.round(day) - 1) % length;
  const wrapped = zeroBased < 0 ? zeroBased + length : zeroBased;
  return wrapped + 1;
}

/**
 * The next day in the rotation. Day N → Day 1. A 1-day cycle always stays on Day 1.
 */
export function advanceCycleDay(currentDay: number, lengthDays: number): number {
  const length = clampCycleLength(lengthDays);
  return normalizeCurrentDay(normalizeCurrentDay(currentDay, length) + 1, length);
}

export function isRestDay(day: CycleDay | null | undefined): boolean {
  return Boolean(day?.isRest);
}

function sanitizeExercises(exercises: unknown): TemplateExercise[] {
  if (!Array.isArray(exercises)) return [];
  const cleaned: TemplateExercise[] = [];
  for (const raw of exercises) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : typeof row.exerciseName === 'string' ? (row.exerciseName as string).trim() : '';
    if (!name) continue;
    const setsRaw = typeof row.sets === 'number' ? row.sets : Number(row.sets);
    const sets = Number.isFinite(setsRaw) && setsRaw > 0 ? Math.round(setsRaw) : 3;
    const exercise: TemplateExercise = {
      name,
      exerciseName: name,
      sets,
      repRange: typeof row.repRange === 'string' ? row.repRange : typeof row.reps === 'string' ? (row.reps as string) : undefined,
      reps: typeof row.reps === 'string' ? (row.reps as string) : undefined,
      restSeconds: Number.isFinite(Number(row.restSeconds)) && Number(row.restSeconds) > 0 ? Math.round(Number(row.restSeconds)) : undefined,
      weightLbs: Number.isFinite(Number(row.weightLbs)) && Number(row.weightLbs) > 0 ? Number(row.weightLbs) : undefined,
      notes: typeof row.notes === 'string' ? (row.notes as string) : undefined,
      exerciseId: typeof row.exerciseId === 'string' ? (row.exerciseId as string) : undefined,
      executionMode: (row.executionMode as TemplateExercise['executionMode']) ?? undefined,
    };
    cleaned.push(exercise);
  }
  return cleaned;
}

function defaultDayLabel(dayNumber: number, isRest: boolean): string {
  return isRest ? 'Rest' : `Day ${dayNumber}`;
}

/**
 * Coerce raw input into a valid cycle: length clamped 1–30, exactly `lengthDays` days renumbered
 * 1..N, rest days carrying no exercises, and `currentDay` wrapped into range.
 */
export function normalizeCycle(input: {
  version?: number;
  lengthDays?: number;
  currentDay?: number;
  anchorDate?: string;
  name?: string;
  days?: Array<Partial<CycleDay>> | null;
}): ProgramCycle {
  const rawDays = Array.isArray(input.days) ? input.days : [];
  // Length follows an explicit lengthDays when given, otherwise the number of days supplied.
  const lengthDays = clampCycleLength(input.lengthDays ?? rawDays.length ?? CYCLE_MIN_DAYS);

  const days: CycleDay[] = [];
  for (let i = 0; i < lengthDays; i += 1) {
    const raw = rawDays[i] ?? {};
    const isRest = Boolean(raw.isRest);
    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : defaultDayLabel(i + 1, isRest);
    days.push({
      dayNumber: i + 1,
      isRest,
      label,
      exercises: isRest ? [] : sanitizeExercises(raw.exercises),
    });
  }

  return {
    version: Number.isFinite(input.version) ? Number(input.version) : 1,
    lengthDays,
    currentDay: normalizeCurrentDay(input.currentDay ?? 1, lengthDays),
    anchorDate: input.anchorDate,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : undefined,
    days,
  };
}

export function cycleDayDefinition(cycle: ProgramCycle, dayNumber: number): CycleDay | undefined {
  const normalized = normalizeCurrentDay(dayNumber, cycle.lengthDays);
  return cycle.days.find((day) => day.dayNumber === normalized);
}

export function currentCycleDay(cycle: ProgramCycle): CycleDay | undefined {
  return cycleDayDefinition(cycle, cycle.currentDay);
}

/**
 * The reducer for "the current day is done": advance the pointer, wrapping Day N back to Day 1.
 * The template (days/version) is untouched, and no history is referenced — completed sessions
 * already live in `workout_sessions`.
 */
export function completeCurrentCycleDay(cycle: ProgramCycle, options?: { anchorDate?: string }): ProgramCycle {
  return {
    ...cycle,
    currentDay: advanceCycleDay(cycle.currentDay, cycle.lengthDays),
    anchorDate: options?.anchorDate ?? cycle.anchorDate,
  };
}

/**
 * Apply a template edit (change days and/or length) while preserving the live `currentDay` pointer.
 * Changes affect FUTURE workouts only: this returns a new template and never touches completed
 * sessions. If the cycle shrinks below the current pointer, the pointer wraps back into range.
 */
export function applyCycleTemplateEdit(
  cycle: ProgramCycle,
  edit: { lengthDays?: number; days?: Array<Partial<CycleDay>>; name?: string },
): ProgramCycle {
  const next = normalizeCycle({
    version: cycle.version + 1,
    lengthDays: edit.lengthDays ?? edit.days?.length ?? cycle.lengthDays,
    currentDay: cycle.currentDay,
    anchorDate: cycle.anchorDate,
    name: edit.name ?? cycle.name,
    days: edit.days ?? cycle.days,
  });
  return next;
}

export type CycleProgress = {
  dayNumber: number;
  lengthDays: number;
  label: string;
  isRest: boolean;
  version: number;
};

export function describeCycleProgress(cycle: ProgramCycle): CycleProgress {
  const day = currentCycleDay(cycle);
  return {
    dayNumber: cycle.currentDay,
    lengthDays: cycle.lengthDays,
    label: day?.label ?? defaultDayLabel(cycle.currentDay, false),
    isRest: isRestDay(day),
    version: cycle.version,
  };
}

/** True when the metadata belongs to a custom day-based cycle rather than the calendar engine. */
export function isCustomCyclePlanPack(planPack: string | null | undefined): boolean {
  return planPack === CUSTOM_CYCLE_PLAN_PACK;
}

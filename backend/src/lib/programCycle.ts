/**
 * Day-based custom program cycle — backend engine (ONE MORE "Basic" feature).
 *
 * A cycle is a Day 1..N rotation (1–30 days) that loops back to Day 1 after the final day, rather
 * than a Monday–Sunday calendar week. The template is stored in `training_programs.metadata.cycle`;
 * completed workouts live in `workout_sessions`. Because the two are separate, editing the template
 * never rewrites history and looping never deletes a previous cycle's data.
 *
 * Pure functions only (no DB) so the loop math, rest-day handling, rollover, template edits, and the
 * calendar-reconciliation reducer are unit-testable. The DB glue lives in `programCycleService.ts`.
 */

export const CYCLE_MIN_DAYS = 1;
export const CYCLE_MAX_DAYS = 30;
export const CUSTOM_CYCLE_PLAN_PACK = 'custom_cycle';

export type CycleTemplateExercise = {
  name: string;
  exerciseName?: string;
  sets: number;
  reps?: string;
  repRange?: string;
  restSeconds?: number;
  weightLbs?: number;
  notes?: string;
  exerciseId?: string;
  executionMode?: string;
};

export type CycleDay = {
  dayNumber: number;
  isRest: boolean;
  label: string;
  exercises: CycleTemplateExercise[];
};

export type ProgramCycle = {
  version: number;
  lengthDays: number;
  currentDay: number;
  anchorDate?: string;
  name?: string;
  days: CycleDay[];
};

export function clampCycleLength(length: number): number {
  if (!Number.isFinite(length)) return CYCLE_MIN_DAYS;
  return Math.min(CYCLE_MAX_DAYS, Math.max(CYCLE_MIN_DAYS, Math.round(length)));
}

/** Wrap any integer into 1..lengthDays. Day N+1 → Day 1; Day 0 → Day N. This makes the cycle loop. */
export function normalizeCurrentDay(day: number, lengthDays: number): number {
  const length = clampCycleLength(lengthDays);
  if (!Number.isFinite(day)) return 1;
  const zeroBased = (Math.round(day) - 1) % length;
  const wrapped = zeroBased < 0 ? zeroBased + length : zeroBased;
  return wrapped + 1;
}

/** The next day in the rotation. Day N → Day 1. A 1-day cycle always stays on Day 1. */
export function advanceCycleDay(currentDay: number, lengthDays: number): number {
  const length = clampCycleLength(lengthDays);
  return normalizeCurrentDay(normalizeCurrentDay(currentDay, length) + 1, length);
}

export function isRestDay(day: CycleDay | null | undefined): boolean {
  return Boolean(day?.isRest);
}

function sanitizeExercises(exercises: unknown): CycleTemplateExercise[] {
  if (!Array.isArray(exercises)) return [];
  const cleaned: CycleTemplateExercise[] = [];
  for (const raw of exercises) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const name =
      typeof row.name === 'string'
        ? row.name.trim()
        : typeof row.exerciseName === 'string'
          ? (row.exerciseName as string).trim()
          : '';
    if (!name) continue;
    const setsRaw = typeof row.sets === 'number' ? row.sets : Number(row.sets);
    const sets = Number.isFinite(setsRaw) && setsRaw > 0 ? Math.round(setsRaw) : 3;
    cleaned.push({
      name,
      exerciseName: name,
      sets,
      repRange:
        typeof row.repRange === 'string' ? row.repRange : typeof row.reps === 'string' ? (row.reps as string) : undefined,
      reps: typeof row.reps === 'string' ? (row.reps as string) : undefined,
      restSeconds:
        Number.isFinite(Number(row.restSeconds)) && Number(row.restSeconds) > 0 ? Math.round(Number(row.restSeconds)) : undefined,
      weightLbs: Number.isFinite(Number(row.weightLbs)) && Number(row.weightLbs) > 0 ? Number(row.weightLbs) : undefined,
      notes: typeof row.notes === 'string' ? (row.notes as string) : undefined,
      exerciseId: typeof row.exerciseId === 'string' ? (row.exerciseId as string) : undefined,
      executionMode: typeof row.executionMode === 'string' ? (row.executionMode as string) : undefined,
    });
  }
  return cleaned;
}

function defaultDayLabel(dayNumber: number, isRest: boolean): string {
  return isRest ? 'Rest' : `Day ${dayNumber}`;
}

export function normalizeCycle(input: {
  version?: number;
  lengthDays?: number;
  currentDay?: number;
  anchorDate?: string;
  name?: string;
  days?: Array<Partial<CycleDay>> | null;
}): ProgramCycle {
  const rawDays = Array.isArray(input.days) ? input.days : [];
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

/** Reducer for "the current day is done": advance the pointer, wrapping Day N back to Day 1. */
export function completeCurrentCycleDay(cycle: ProgramCycle, options?: { anchorDate?: string }): ProgramCycle {
  return {
    ...cycle,
    currentDay: advanceCycleDay(cycle.currentDay, cycle.lengthDays),
    anchorDate: options?.anchorDate ?? cycle.anchorDate,
  };
}

/** Apply a template edit while preserving the live pointer. Future workouts only; history untouched. */
export function applyCycleTemplateEdit(
  cycle: ProgramCycle,
  edit: { lengthDays?: number; days?: Array<Partial<CycleDay>>; name?: string },
): ProgramCycle {
  return normalizeCycle({
    version: cycle.version + 1,
    lengthDays: edit.lengthDays ?? edit.days?.length ?? cycle.lengthDays,
    currentDay: cycle.currentDay,
    anchorDate: cycle.anchorDate,
    name: edit.name ?? cycle.name,
    days: edit.days ?? cycle.days,
  });
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T12:00:00.000Z').getTime();
  const to = new Date(toIso + 'T12:00:00.000Z').getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export type CycleReconcileResult = {
  cycle: ProgramCycle;
  /** True if the pointer moved because rest days elapsed on the calendar. */
  advanced: boolean;
  /** The cycle day that should be materialized for `today`. */
  activeDayNumber: number;
};

/**
 * Reconcile the pointer against the calendar on load / day rollover.
 *
 * Rest days pass automatically as the calendar advances past their scheduled date, so a user who
 * opens the app after a rest day sees the next workout day. Workout days do NOT auto-advance — a
 * missed workout day simply rolls forward to today (completion is what advances a workout day, so
 * history is never fabricated). The pointer only ever moves forward and always stays in range.
 */
export function reconcileCycleForDate(cycle: ProgramCycle, today: string, options?: { maxSteps?: number }): CycleReconcileResult {
  const anchor = cycle.anchorDate;
  if (!anchor) {
    return { cycle: { ...cycle, anchorDate: today }, advanced: false, activeDayNumber: cycle.currentDay };
  }

  let elapsed = daysBetweenIso(anchor, today);
  if (elapsed <= 0) {
    return { cycle, advanced: false, activeDayNumber: cycle.currentDay };
  }

  // Guard against absurd gaps (e.g. months away) so we never loop unbounded.
  const maxSteps = options?.maxSteps ?? CYCLE_MAX_DAYS * 2;
  let working = { ...cycle };
  let advanced = false;
  let steps = 0;
  while (elapsed > 0 && steps < maxSteps) {
    const day = currentCycleDay(working);
    if (!isRestDay(day)) break; // Workout days wait for completion; roll them to today instead.
    working = completeCurrentCycleDay(working, { anchorDate: today });
    advanced = true;
    elapsed -= 1;
    steps += 1;
  }

  return {
    cycle: { ...working, anchorDate: today },
    advanced,
    activeDayNumber: working.currentDay,
  };
}

export function isCustomCyclePlanPack(planPack: string | null | undefined): boolean {
  return planPack === CUSTOM_CYCLE_PLAN_PACK;
}

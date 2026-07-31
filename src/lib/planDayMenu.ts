/**
 * Pure Manage Day / Edit Day menu construction.
 *
 * Split out of `planDayActions` so move/swap can be unit-tested: that module pulls in
 * React Native (Alert) and AsyncStorage, neither of which loads under the node test runner.
 * The RN-backed side effects are injected by the caller.
 */

import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { logPlanDayContext, type PlanDayMoveTarget } from '@/lib/planDayDebug';
import {
    buildWeeklyPlanEntries,
    dedupePlannedWorkoutsByDate,
    type WeeklyPlanEntry,
} from '@/lib/weekPlan';
import type { ScheduleChange } from '@/types/planAdaptation';
import type { PlannedWorkout } from '@/types/training';

export type ManageDayAction = {
  id: string;
  label: string;
  destructive?: boolean;
  /** Opens an inline picker in ManageDayModal instead of a follow-up alert. */
  picker?: 'swap' | 'move' | 'rest' | 'do-today';
  onPress: () => void;
};

export type ManageDayPickerOption = {
  id: string;
  label: string;
};

export type ManageDayMenuContent = {
  weeklyPlan: WeeklyPlanEntry[];
  /** Calendar date this menu applies to. */
  focusDate: string;
  todayLabel: string;
  focusWorkoutId: string | null;
  actions: ManageDayAction[];
  swapTargets: ManageDayPickerOption[];
  moveTargets: ManageDayPickerOption[];
  restDayTargets: ManageDayPickerOption[];
  doTodayTargets: ManageDayPickerOption[];
  onScheduleChange: (change: ScheduleChange) => void;
  title?: string;
  showWeekList?: boolean;
  /** @deprecated use focusDate */
  todayDate?: string;
  /** @deprecated use focusWorkoutId */
  todayWorkoutId?: string | null;
};

export type MenuBuildInput = {
  workouts: PlannedWorkout[];
  timeZone?: string | null;
  /** Runs a schedule adaptation (move / swap / skip). */
  onScheduleChange: (change: ScheduleChange) => void;
  /** Confirms turning the focused day into a rest day. */
  onConfirmSkip: (workout: PlannedWorkout) => void;
  onStartWorkout?: () => void;
  onEditExercises?: () => void;
  reference?: Date;
};

function entryLabel(entry: WeeklyPlanEntry): string {
  return entry.isRestDay ? `${entry.day} · Rest` : `${entry.day} · ${entry.title}`;
}

function moveTargetsForDate(
  weeklyPlan: WeeklyPlanEntry[],
  excludeDate: string,
): PlanDayMoveTarget[] {
  return weeklyPlan
    .filter((entry) => entry.date !== excludeDate)
    .map((entry) => ({
      day: entry.day,
      date: entry.date,
      title: entry.title,
      workoutId: entry.workoutId,
    }));
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type MenuParts = {
  weeklyPlan: WeeklyPlanEntry[];
  focusWorkout: PlannedWorkout | undefined;
  hasOtherWorkouts: boolean;
  swapTargets: ManageDayPickerOption[];
  moveTargets: ManageDayPickerOption[];
  restDayTargets: ManageDayPickerOption[];
  doTodayTargets: ManageDayPickerOption[];
};

function buildParts(input: MenuBuildInput, focusDate: string, source: string): MenuParts {
  const reference = input.reference ?? new Date();
  const normalized = dedupePlannedWorkoutsByDate(input.workouts, reference, input.timeZone);
  const weeklyPlan = buildWeeklyPlanEntries(input.workouts, reference, input.timeZone);
  const availableMoveTargets = moveTargetsForDate(weeklyPlan, focusDate);

  const resolved = resolveActiveTrainingDay(input.workouts, {
    date: focusDate,
    timeZone: input.timeZone,
  });
  logPlanDayContext(source, focusDate, weeklyPlan, availableMoveTargets, resolved);

  const focusWorkout = resolveActiveTrainingDay(normalized, {
    date: focusDate,
    timeZone: input.timeZone,
  }).workout ?? undefined;

  return {
    weeklyPlan,
    focusWorkout,
    hasOtherWorkouts: weeklyPlan.some((entry) => entry.date !== focusDate && entry.workoutId),
    swapTargets: weeklyPlan
      .filter(
        (entry) =>
          entry.date !== focusDate && entry.workoutId && entry.workoutId !== focusWorkout?.id,
      )
      .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) })),
    moveTargets: availableMoveTargets.map((target) => ({
      id: target.date,
      label: target.workoutId ? `${target.day} · ${target.title} (swap)` : `${target.day} · Rest`,
    })),
    restDayTargets: weeklyPlan
      .filter((entry) => entry.date !== focusDate && entry.isRestDay)
      .map((entry) => ({ id: entry.date, label: entryLabel(entry) })),
    doTodayTargets: weeklyPlan
      .filter((entry) => entry.date !== focusDate && entry.workoutId)
      .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) })),
  };
}

/** Home screen — Manage Day for today. */
export function buildHomeManageDayMenuContent(
  input: MenuBuildInput,
  today: string,
): ManageDayMenuContent | null {
  const parts = buildParts(input, today, 'manage-day');
  const todayWorkout = parts.focusWorkout;
  const actions: ManageDayAction[] = [];

  if (!todayWorkout && parts.hasOtherWorkouts) {
    actions.push({ id: 'do-today', label: 'Do Today', picker: 'do-today', onPress: () => {} });
  }

  if (todayWorkout) {
    actions.push({
      id: 'move-tomorrow',
      label: 'Move To Tomorrow',
      onPress: () =>
        input.onScheduleChange({
          type: 'move',
          workoutId: todayWorkout.id,
          toDate: addDays(today, 1),
        }),
    });
    actions.push({ id: 'move-day', label: 'Move To Another Day', picker: 'move', onPress: () => {} });
    actions.push({
      id: 'swap-workout',
      label: 'Swap With Another Workout',
      picker: 'swap',
      onPress: () => {},
    });
    actions.push({ id: 'swap-rest', label: 'Swap With Rest Day', picker: 'rest', onPress: () => {} });
    actions.push({
      id: 'make-rest',
      label: 'Make Today Rest Day',
      destructive: true,
      onPress: () => input.onConfirmSkip(todayWorkout),
    });
  } else if (parts.hasOtherWorkouts) {
    actions.push({
      id: 'swap-rest',
      label: 'Swap With Rest Day',
      picker: 'do-today',
      onPress: () => {},
    });
  }

  if (actions.length === 0) return null;

  return {
    weeklyPlan: parts.weeklyPlan,
    focusDate: today,
    todayLabel: todayWorkout ? `Today: ${todayWorkout.name}` : 'Today is a rest day',
    focusWorkoutId: todayWorkout?.id ?? null,
    actions,
    swapTargets: parts.swapTargets,
    moveTargets: parts.moveTargets,
    restDayTargets: parts.restDayTargets,
    doTodayTargets: parts.doTodayTargets,
    onScheduleChange: input.onScheduleChange,
    title: 'Manage Day',
    showWeekList: true,
  };
}

/** Workout tab — Edit Day for any date in the weekly planner. */
export function buildEditDayMenuContent(
  input: MenuBuildInput,
  date: string,
): ManageDayMenuContent | null {
  const parts = buildParts(input, date, 'edit-day');
  const dayWorkout = parts.focusWorkout;
  const actions: ManageDayAction[] = [];

  if (dayWorkout && input.onEditExercises) {
    actions.push({ id: 'edit-exercises', label: 'Edit Exercises', onPress: input.onEditExercises });
  }

  if (dayWorkout) {
    actions.push({ id: 'move-day', label: 'Move', picker: 'move', onPress: () => {} });
    actions.push({ id: 'swap-workout', label: 'Swap', picker: 'swap', onPress: () => {} });
    actions.push({ id: 'swap-rest', label: 'Swap With Rest Day', picker: 'rest', onPress: () => {} });
    actions.push({
      id: 'make-rest',
      label: 'Make Rest Day',
      destructive: true,
      onPress: () => input.onConfirmSkip(dayWorkout),
    });
    if (input.onStartWorkout) {
      actions.push({ id: 'start-workout', label: 'Start Workout', onPress: input.onStartWorkout });
    }
  } else if (parts.hasOtherWorkouts) {
    actions.push({
      id: 'move-here',
      label: 'Move Workout Here',
      picker: 'do-today',
      onPress: () => {},
    });
  }

  if (actions.length === 0) return null;

  const dayEntry = parts.weeklyPlan.find((entry) => entry.date === date);
  const dayLabel = dayEntry
    ? dayEntry.isRestDay
      ? `${dayEntry.day}: Rest`
      : `${dayEntry.day}: ${dayEntry.title}`
    : date;

  return {
    weeklyPlan: parts.weeklyPlan,
    focusDate: date,
    todayLabel: dayLabel,
    focusWorkoutId: dayWorkout?.id ?? null,
    actions,
    swapTargets: parts.swapTargets,
    moveTargets: parts.moveTargets,
    restDayTargets: parts.restDayTargets,
    doTodayTargets: parts.doTodayTargets,
    onScheduleChange: input.onScheduleChange,
    title: 'Edit Day',
    showWeekList: false,
  };
}

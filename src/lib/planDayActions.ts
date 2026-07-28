import { Alert, InteractionManager } from 'react-native';

import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { syncGroceriesAfterPlanAdaptation } from '@/lib/planAdaptationClient';
import { planDataCache } from '@/lib/planDataCache';
import { invalidateWeekPlanPrefetch } from '@/lib/planDataPrefetch';
import { logPlanDayContext, type PlanDayMoveTarget } from '@/lib/planDayDebug';
import {
    buildWeeklyPlanEntries,
    dedupePlannedWorkoutsByDate,
    getWeekRange,
    mergePlannedWorkoutsPreferringReschedule,
    patchPlannedWorkoutsForChange,
    type WeeklyPlanEntry,
} from '@/lib/weekPlan';
import { trainingService } from '@/services/trainingService';
import type { PlanAdaptationResult, ScheduleChange } from '@/types/planAdaptation';
import type { PlannedWorkout } from '@/types/training';

export type PlanDayActionDeps = {
  userId: string;
  workouts: PlannedWorkout[];
  setFromAdaptation: (result: PlanAdaptationResult) => void;
  onComplete?: () => void;
  onWorkoutsUpdated?: (workouts: PlannedWorkout[]) => void;
  onBusyChange?: (busy: boolean) => void;
  timeZone?: string | null;
};

/** iOS silently drops alerts presented while a modal is dismissing. */
function presentAlert(title: string, message?: string, buttons?: Parameters<typeof Alert.alert>[2]) {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => Alert.alert(title, message, buttons), 300);
  });
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateString(d);
}

function normalizeWorkouts(deps: PlanDayActionDeps): PlannedWorkout[] {
  return dedupePlannedWorkoutsByDate(deps.workouts, new Date(), deps.timeZone);
}

function weeklyPlanFor(deps: PlanDayActionDeps): WeeklyPlanEntry[] {
  return buildWeeklyPlanEntries(deps.workouts, new Date(), deps.timeZone);
}

function entryLabel(entry: WeeklyPlanEntry): string {
  return entry.isRestDay ? `${entry.day} · Rest` : `${entry.day} · ${entry.title}`;
}

function plannedWorkoutOnDate(
  workouts: PlannedWorkout[],
  date: string,
  timeZone?: string | null,
): PlannedWorkout | undefined {
  return resolveActiveTrainingDay(workouts, { date, timeZone }).workout ?? undefined;
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

function logBeforeModal(
  source: string,
  activeTrainingDay: string,
  deps: PlanDayActionDeps,
  availableMoveTargets: PlanDayMoveTarget[],
): WeeklyPlanEntry[] {
  const weeklyPlan = weeklyPlanFor(deps);
  const resolved = resolveActiveTrainingDay(deps.workouts, {
    date: activeTrainingDay,
    timeZone: deps.timeZone,
  });
  logPlanDayContext(source, activeTrainingDay, weeklyPlan, availableMoveTargets, resolved);
  return weeklyPlan;
}

async function executeAdapt(deps: PlanDayActionDeps, change: ScheduleChange) {
  // Optimistic UI first so swap/move never feels frozen while the API runs.
  const patched = dedupePlannedWorkoutsByDate(
    patchPlannedWorkoutsForChange(deps.workouts, change),
    new Date(),
    deps.timeZone,
  );
  const { from, to } = getWeekRange(new Date(), deps.timeZone ?? undefined);
  deps.onWorkoutsUpdated?.(patched);
  invalidateWeekPlanPrefetch(deps.userId, deps.timeZone ?? undefined);
  void planDataCache.writeWorkouts(deps.userId, from, to, patched);

  deps.onBusyChange?.(true);
  try {
    const result = await trainingService.adaptScheduleChange(deps.userId, change);
    if (result.success) {
      deps.setFromAdaptation(result.data);

      void (async () => {
        const workoutsResult = await trainingService.getPlannedWorkouts(
          deps.userId,
          from,
          to,
          deps.timeZone,
        );
        if (workoutsResult.success) {
          const merged = mergePlannedWorkoutsPreferringReschedule(
            patched,
            workoutsResult.data,
            new Date(),
            deps.timeZone,
          );
          await planDataCache.writeWorkouts(deps.userId, from, to, merged);
          deps.onWorkoutsUpdated?.(merged);
        }
      })();

      void syncGroceriesAfterPlanAdaptation(deps.userId, result.data);
      deps.onComplete?.();
    } else {
      presentAlert('Could not adjust plan', result.error);
      deps.onComplete?.();
    }
  } catch (error) {
    presentAlert(
      'Could not adjust plan',
      error instanceof Error ? error.message : 'Something went wrong. Try again.',
    );
    deps.onComplete?.();
  } finally {
    deps.onBusyChange?.(false);
  }
}

function confirmSkip(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  presentAlert('Make rest day?', `${workout.name} will become a recovery day.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Make Rest Day',
      style: 'destructive',
      onPress: () => void executeAdapt(deps, { type: 'skip', workoutId: workout.id }),
    },
  ]);
}

function promptMoveWorkoutToDate(
  deps: PlanDayActionDeps,
  workout: PlannedWorkout,
  toDate: string,
) {
  void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate });
}

function promptMoveToDay(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  const availableMoveTargets = moveTargetsForDate(weeklyPlanFor(deps), workout.scheduledDate);
  logBeforeModal('move-to-day', workout.scheduledDate, deps, availableMoveTargets);

  if (availableMoveTargets.length === 0) {
    presentAlert('No open days', 'No other days available this week.');
    return;
  }

  presentAlert('Move to another day', `${workout.name}`, [
    ...availableMoveTargets.map((target) => ({
      text: target.workoutId
        ? `${target.day} · ${target.title} (swap)`
        : `${target.day} · Rest`,
      onPress: () => promptMoveWorkoutToDate(deps, workout, target.date),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptSwapWithWorkout(deps: PlanDayActionDeps, source: PlannedWorkout, weeklyPlan: WeeklyPlanEntry[]) {
  const normalized = normalizeWorkouts(deps);
  const targets = weeklyPlan.filter(
    (entry) => entry.date !== source.scheduledDate && entry.workoutId && entry.workoutId !== source.id,
  );

  if (targets.length === 0) {
    presentAlert('No swap target', 'No other planned workouts to swap with.');
    return;
  }

  presentAlert('Swap with', source.name, [
    ...targets.map((entry) => ({
      text: entryLabel(entry),
      onPress: () => {
        const targetWorkout = normalized.find((w) => w.id === entry.workoutId);
        if (!targetWorkout) return;
        void executeAdapt(deps, { type: 'swap', workoutIdA: source.id, workoutIdB: targetWorkout.id });
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptSwapWithRestDay(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  const weeklyPlan = weeklyPlanFor(deps);
  const restTargets = weeklyPlan.filter((entry) => entry.date !== workout.scheduledDate && entry.isRestDay);
  const availableMoveTargets = restTargets.map((entry) => ({
    day: entry.day,
    date: entry.date,
    title: entry.title,
    workoutId: entry.workoutId,
  }));
  logBeforeModal('swap-with-rest', workout.scheduledDate, deps, availableMoveTargets);

  if (restTargets.length === 0) {
    presentAlert('No rest day', 'Every other day this week already has a workout.');
    return;
  }

  presentAlert('Swap with rest day', 'Choose a rest day to exchange with', [
    ...restTargets.map((entry) => ({
      text: entryLabel(entry),
      onPress: () => promptMoveWorkoutToDate(deps, workout, entry.date),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptDoToday(deps: PlanDayActionDeps, today: string) {
  const normalized = normalizeWorkouts(deps);
  const weeklyPlan = weeklyPlanFor(deps);
  const moveCandidates = weeklyPlan.filter((entry) => entry.date !== today && entry.workoutId);
  const availableMoveTargets = moveCandidates.map((entry) => ({
    day: entry.day,
    date: entry.date,
    title: entry.title,
    workoutId: entry.workoutId,
  }));
  logBeforeModal('do-today', today, deps, availableMoveTargets);

  if (moveCandidates.length === 0) {
    presentAlert('No workouts', 'No planned workouts available to move to today.');
    return;
  }

  presentAlert('Do today', 'Move which workout to today?', [
    ...moveCandidates.map((entry) => ({
      text: entryLabel(entry),
      onPress: () => {
        const workout = normalized.find((w) => w.id === entry.workoutId);
        if (!workout) return;
        promptMoveWorkoutToDate(deps, workout, today);
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function formatWeekSchedule(weeklyPlan: WeeklyPlanEntry[]): string {
  return weeklyPlan.map((entry) => (entry.isRestDay ? `${entry.day}: Rest` : `${entry.day}: ${entry.title}`)).join('\n');
}

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

/** Run a schedule adaptation from Manage Day or the weekly planner. */
export function runScheduleAdaptation(deps: PlanDayActionDeps, change: ScheduleChange): void {
  void executeAdapt(deps, change);
}

/** Home screen — structured Manage Day menu content. */
export function buildHomeManageDayMenu(
  deps: PlanDayActionDeps,
  today = localDateString(),
): ManageDayMenuContent | null {
  const normalized = normalizeWorkouts(deps);
  const weeklyPlan = weeklyPlanFor(deps);
  const availableMoveTargets = moveTargetsForDate(weeklyPlan, today);
  logBeforeModal('manage-day', today, deps, availableMoveTargets);

  const todayWorkout = plannedWorkoutOnDate(normalized, today, deps.timeZone);
  const tomorrow = addDays(today, 1);
  const hasOtherWorkouts = weeklyPlan.some((entry) => entry.date !== today && entry.workoutId);
  const actions: ManageDayAction[] = [];

  const swapTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== today && entry.workoutId && entry.workoutId !== todayWorkout?.id)
    .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) }));

  const moveTargets: ManageDayPickerOption[] = availableMoveTargets.map((target) => ({
    id: target.date,
    label: target.workoutId ? `${target.day} · ${target.title} (swap)` : `${target.day} · Rest`,
  }));

  const restDayTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== today && entry.isRestDay)
    .map((entry) => ({ id: entry.date, label: entryLabel(entry) }));

  const doTodayTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== today && entry.workoutId)
    .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) }));

  const onScheduleChange = (change: ScheduleChange) => runScheduleAdaptation(deps, change);

  if (!todayWorkout && hasOtherWorkouts) {
    actions.push({ id: 'do-today', label: 'Do Today', picker: 'do-today', onPress: () => {} });
  }

  if (todayWorkout) {
    actions.push({
      id: 'move-tomorrow',
      label: 'Move To Tomorrow',
      onPress: () => onScheduleChange({ type: 'move', workoutId: todayWorkout.id, toDate: tomorrow }),
    });
    actions.push({
      id: 'move-day',
      label: 'Move To Another Day',
      picker: 'move',
      onPress: () => {},
    });
    actions.push({
      id: 'swap-workout',
      label: 'Swap With Another Workout',
      picker: 'swap',
      onPress: () => {},
    });
    actions.push({
      id: 'swap-rest',
      label: 'Swap With Rest Day',
      picker: 'rest',
      onPress: () => {},
    });
    actions.push({
      id: 'make-rest',
      label: 'Make Today Rest Day',
      destructive: true,
      onPress: () => confirmSkip(deps, todayWorkout),
    });
  } else if (hasOtherWorkouts) {
    actions.push({ id: 'swap-rest', label: 'Swap With Rest Day', picker: 'do-today', onPress: () => {} });
  }

  if (actions.length === 0) return null;

  const todayLabel = todayWorkout ? `Today: ${todayWorkout.name}` : 'Today is a rest day';

  return {
    weeklyPlan,
    focusDate: today,
    todayLabel,
    focusWorkoutId: todayWorkout?.id ?? null,
    actions,
    swapTargets,
    moveTargets,
    restDayTargets,
    doTodayTargets,
    onScheduleChange,
    title: 'Manage Day',
    showWeekList: true,
  };
}

export type EditDayMenuOptions = {
  onStartWorkout?: () => void;
  onEditExercises?: () => void;
};

/** Workout tab — Edit Day for any date in the weekly planner. */
export function buildEditDayMenu(
  deps: PlanDayActionDeps,
  date: string,
  options?: EditDayMenuOptions,
): ManageDayMenuContent | null {
  const normalized = normalizeWorkouts(deps);
  const weeklyPlan = weeklyPlanFor(deps);
  const availableMoveTargets = moveTargetsForDate(weeklyPlan, date);
  logBeforeModal('edit-day', date, deps, availableMoveTargets);

  const dayWorkout = plannedWorkoutOnDate(normalized, date, deps.timeZone);
  const hasOtherWorkouts = weeklyPlan.some((entry) => entry.date !== date && entry.workoutId);
  const actions: ManageDayAction[] = [];

  const swapTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== date && entry.workoutId && entry.workoutId !== dayWorkout?.id)
    .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) }));

  const moveTargets: ManageDayPickerOption[] = availableMoveTargets.map((target) => ({
    id: target.date,
    label: target.workoutId ? `${target.day} · ${target.title} (swap)` : `${target.day} · Rest`,
  }));

  const restDayTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== date && entry.isRestDay)
    .map((entry) => ({ id: entry.date, label: entryLabel(entry) }));

  const doTodayTargets: ManageDayPickerOption[] = weeklyPlan
    .filter((entry) => entry.date !== date && entry.workoutId)
    .map((entry) => ({ id: entry.workoutId!, label: entryLabel(entry) }));

  const onScheduleChange = (change: ScheduleChange) => runScheduleAdaptation(deps, change);

  if (dayWorkout && options?.onEditExercises) {
    actions.push({
      id: 'edit-exercises',
      label: 'Edit Exercises',
      onPress: options.onEditExercises,
    });
  }

  if (!dayWorkout && hasOtherWorkouts) {
    actions.push({ id: 'do-today', label: 'Move Workout Here', picker: 'do-today', onPress: () => {} });
  }

  if (dayWorkout) {
    actions.push({
      id: 'move-day',
      label: 'Move',
      picker: 'move',
      onPress: () => {},
    });
    actions.push({
      id: 'swap-workout',
      label: 'Swap',
      picker: 'swap',
      onPress: () => {},
    });
    actions.push({
      id: 'swap-rest',
      label: 'Swap With Rest Day',
      picker: 'rest',
      onPress: () => {},
    });
    actions.push({
      id: 'make-rest',
      label: 'Make Rest Day',
      destructive: true,
      onPress: () => confirmSkip(deps, dayWorkout),
    });
    if (options?.onStartWorkout) {
      actions.push({
        id: 'start-workout',
        label: 'Start Workout',
        onPress: options.onStartWorkout,
      });
    }
  } else if (hasOtherWorkouts) {
    actions.push({ id: 'move-here', label: 'Move Workout Here', picker: 'do-today', onPress: () => {} });
  }

  if (actions.length === 0) return null;

  const dayEntry = weeklyPlan.find((entry) => entry.date === date);
  const dayLabel = dayEntry
    ? dayEntry.isRestDay
      ? `${dayEntry.day}: Rest`
      : `${dayEntry.day}: ${dayEntry.title}`
    : date;

  return {
    weeklyPlan,
    focusDate: date,
    todayLabel: dayLabel,
    focusWorkoutId: dayWorkout?.id ?? null,
    actions,
    swapTargets,
    moveTargets,
    restDayTargets,
    doTodayTargets,
    onScheduleChange,
    title: 'Edit Day',
    showWeekList: false,
  };
}

/** Home screen — legacy alert-based Manage Day menu. */
export function showHomeManageDayMenu(deps: PlanDayActionDeps, today = localDateString()) {
  const content = buildHomeManageDayMenu(deps, today);
  if (!content) {
    Alert.alert('Manage Day', 'No planned workouts this week to adjust.');
    return;
  }

  Alert.alert('Manage Day', `${formatWeekSchedule(content.weeklyPlan)}\n\n${content.todayLabel}`, [
    ...content.actions.map((action) => ({
      text: action.label,
      style: action.destructive ? ('destructive' as const) : undefined,
      onPress: action.onPress,
    })),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

/** @deprecated Use buildEditDayMenu + ManageDayModal instead. */
export function showWeeklyEditDayMenu(
  deps: PlanDayActionDeps,
  date: string,
  onStartWorkout?: () => void,
) {
  const content = buildEditDayMenu(deps, date, { onStartWorkout });
  if (!content) {
    presentAlert('Edit Day', 'No workouts available to adjust this week.');
    return;
  }
  // Prefer ManageDayModal — Alert cannot host move/swap pickers.
  presentAlert(
    content.title ?? 'Edit Day',
    `${content.todayLabel}\n\nOpen Edit day from the Workout week list to move or swap days.`,
    [{ text: 'OK' }],
  );
}

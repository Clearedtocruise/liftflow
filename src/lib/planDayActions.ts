import { Alert } from 'react-native';

import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { syncGroceriesAfterPlanAdaptation } from '@/lib/planAdaptationClient';
import { logPlanDayContext, type PlanDayMoveTarget } from '@/lib/planDayDebug';
import {
    buildWeeklyPlanEntries,
    dedupePlannedWorkoutsByDate,
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
  onBusyChange?: (busy: boolean) => void;
  timeZone?: string | null;
};

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

function plannedWorkoutOnDate(workouts: PlannedWorkout[], date: string): PlannedWorkout | undefined {
  return workouts.find((w) => w.scheduledDate === date && w.status === 'planned');
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
  deps.onBusyChange?.(true);
  const result = await trainingService.adaptScheduleChange(deps.userId, change);
  deps.onBusyChange?.(false);
  if (result.success) {
    deps.setFromAdaptation(result.data);
    void syncGroceriesAfterPlanAdaptation(deps.userId, result.data);
    deps.onComplete?.();
  } else {
    Alert.alert('Could not adjust plan', result.error);
  }
}

function confirmSkip(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  Alert.alert('Make rest day?', `${workout.name} will become a recovery day.`, [
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
    Alert.alert('No open days', 'No other days available this week.');
    return;
  }

  Alert.alert('Move to another day', `${workout.name}`, [
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
    Alert.alert('No swap target', 'No other planned workouts to swap with.');
    return;
  }

  Alert.alert('Swap with', source.name, [
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
    Alert.alert('No rest day', 'Every other day this week already has a workout.');
    return;
  }

  Alert.alert('Swap with rest day', 'Choose a rest day to exchange with', [
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
    Alert.alert('No workouts', 'No planned workouts available to move to today.');
    return;
  }

  Alert.alert('Do today', 'Move which workout to today?', [
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

/** Home screen — Manage Day menu for today. */
export function showHomeManageDayMenu(deps: PlanDayActionDeps, today = localDateString()) {
  const normalized = normalizeWorkouts(deps);
  const weeklyPlan = weeklyPlanFor(deps);
  const availableMoveTargets = moveTargetsForDate(weeklyPlan, today);
  logBeforeModal('manage-day', today, deps, availableMoveTargets);

  const todayWorkout = plannedWorkoutOnDate(normalized, today);
  const tomorrow = addDays(today, 1);
  const hasOtherWorkouts = weeklyPlan.some((entry) => entry.date !== today && entry.workoutId);

  type AlertOption = { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void };
  const options: AlertOption[] = [];

  if (!todayWorkout && hasOtherWorkouts) {
    options.push({ text: 'Do Today', onPress: () => promptDoToday(deps, today) });
  }

  if (todayWorkout) {
    options.push({
      text: 'Move To Tomorrow',
      onPress: () => void executeAdapt(deps, { type: 'move', workoutId: todayWorkout.id, toDate: tomorrow }),
    });
    options.push({
      text: 'Move To Another Day',
      onPress: () => promptMoveToDay(deps, todayWorkout),
    });
    options.push({
      text: 'Swap With Rest Day',
      onPress: () => promptSwapWithRestDay(deps, todayWorkout),
    });
    options.push({
      text: 'Make Today Rest Day',
      style: 'destructive',
      onPress: () => confirmSkip(deps, todayWorkout),
    });
  } else if (hasOtherWorkouts) {
    options.push({ text: 'Swap With Rest Day', onPress: () => promptDoToday(deps, today) });
  }

  if (options.length === 0) {
    Alert.alert('Manage Day', 'No planned workouts this week to adjust.');
    return;
  }

  Alert.alert(
    'Manage Day',
    `${formatWeekSchedule(weeklyPlan)}\n\n${todayWorkout ? `Today: ${todayWorkout.name}` : 'Today is a rest day.'}`,
    [...options, { text: 'Cancel', style: 'cancel' }],
  );
}

/** Weekly planner — Edit Day menu for a specific date. */
export function showWeeklyEditDayMenu(
  deps: PlanDayActionDeps,
  date: string,
  onStartWorkout?: () => void,
) {
  const normalized = normalizeWorkouts(deps);
  const weeklyPlan = weeklyPlanFor(deps);
  const dayWorkout = plannedWorkoutOnDate(normalized, date);
  const moveCandidates = weeklyPlan.filter((entry) => entry.date !== date && entry.workoutId);
  const availableMoveTargets = moveCandidates.map((entry) => ({
    day: entry.day,
    date: entry.date,
    title: entry.title,
    workoutId: entry.workoutId,
  }));
  logBeforeModal('edit-day', date, deps, availableMoveTargets);

  type AlertOption = { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void };
  const options: AlertOption[] = [];

  if (dayWorkout) {
    options.push({ text: 'Move', onPress: () => promptMoveToDay(deps, dayWorkout) });
    options.push({ text: 'Swap', onPress: () => promptSwapWithWorkout(deps, dayWorkout, weeklyPlan) });
    options.push({
      text: 'Make Rest Day',
      style: 'destructive',
      onPress: () => confirmSkip(deps, dayWorkout),
    });
    if (onStartWorkout) {
      options.push({ text: 'Start Workout', onPress: onStartWorkout });
    }
  } else if (moveCandidates.length > 0) {
    options.push({
      text: 'Move',
      onPress: () => {
        Alert.alert('Move workout here', formatWeekSchedule(weeklyPlan), [
          ...moveCandidates.map((entry) => ({
            text: entryLabel(entry),
            onPress: () => {
              const workout = normalized.find((w) => w.id === entry.workoutId);
              if (!workout) return;
              promptMoveWorkoutToDate(deps, workout, date);
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      },
    });
    options.push({
      text: 'Swap',
      onPress: () => {
        Alert.alert('Swap onto this day', formatWeekSchedule(weeklyPlan), [
          ...moveCandidates.map((entry) => ({
            text: entryLabel(entry),
            onPress: () => {
              const workout = normalized.find((w) => w.id === entry.workoutId);
              if (!workout) return;
              promptMoveWorkoutToDate(deps, workout, date);
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      },
    });
    if (onStartWorkout) {
      options.push({ text: 'Start Workout', onPress: onStartWorkout });
    }
  }

  if (options.length === 0) {
    Alert.alert('Edit Day', 'No workouts available to move this week.');
    return;
  }

  const dayEntry = weeklyPlan.find((entry) => entry.date === date);
  Alert.alert(
    'Edit Day',
    dayEntry ? (dayEntry.isRestDay ? `${dayEntry.day}: Rest` : `${dayEntry.day}: ${dayEntry.title}`) : date,
    [...options, { text: 'Cancel', style: 'cancel' }],
  );
}

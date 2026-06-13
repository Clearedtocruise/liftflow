import { Alert } from 'react-native';

import { syncGroceriesAfterPlanAdaptation } from '@/lib/planAdaptationClient';
import { localDateString } from '@/lib/localDate';
import { getWeekRange, WEEKDAY_LABELS } from '@/lib/weekPlan';
import { trainingService } from '@/services/trainingService';
import type { PlannedWorkout } from '@/types/training';
import type { PlanAdaptationResult, ScheduleChange } from '@/types/planAdaptation';

export type PlanDayActionDeps = {
  userId: string;
  workouts: PlannedWorkout[];
  setFromAdaptation: (result: PlanAdaptationResult) => void;
  onComplete?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateString(d);
}

function formatDayShort(dateStr: string): string {
  const { dates } = getWeekRange();
  const index = dates.indexOf(dateStr);
  const label = index >= 0 ? WEEKDAY_LABELS[index] : dateStr;
  return `${label} (${dateStr.slice(5)})`;
}

function plannedWorkoutOnDate(workouts: PlannedWorkout[], date: string): PlannedWorkout | undefined {
  return workouts.find((w) => w.scheduledDate === date && w.status === 'planned');
}

function plannedWorkoutsThisWeek(workouts: PlannedWorkout[]): PlannedWorkout[] {
  const { dates } = getWeekRange();
  const week = new Set(dates);
  return workouts.filter((w) => w.status === 'planned' && week.has(w.scheduledDate));
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

function promptPickWorkout(
  title: string,
  message: string,
  workouts: PlannedWorkout[],
  onPick: (workout: PlannedWorkout) => void,
) {
  if (workouts.length === 0) {
    Alert.alert('No workouts', 'No planned workouts available this week.');
    return;
  }
  Alert.alert(title, message, [
    ...workouts.map((w) => ({
      text: `${w.name} · ${formatDayShort(w.scheduledDate)}`,
      onPress: () => onPick(w),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptMoveToDay(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  const { dates } = getWeekRange();
  const targets = dates.filter((d) => d !== workout.scheduledDate);
  if (targets.length === 0) {
    Alert.alert('No open days', 'No other days available this week.');
    return;
  }
  Alert.alert('Move to another day', workout.name, [
    ...targets.map((date) => ({
      text: formatDayShort(date),
      onPress: () => void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate: date }),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptSwapWithWorkout(deps: PlanDayActionDeps, source: PlannedWorkout) {
  const others = plannedWorkoutsThisWeek(deps.workouts).filter((w) => w.id !== source.id);
  if (others.length === 0) {
    Alert.alert('No swap target', 'No other planned workouts to swap with.');
    return;
  }
  Alert.alert('Swap with', source.name, [
    ...others.map((w) => ({
      text: `${w.name} · ${formatDayShort(w.scheduledDate)}`,
      onPress: () =>
        void executeAdapt(deps, { type: 'swap', workoutIdA: source.id, workoutIdB: w.id }),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptSwapWithRestDay(deps: PlanDayActionDeps, workout: PlannedWorkout) {
  const { dates } = getWeekRange();
  const restDates = dates.filter((d) => d !== workout.scheduledDate && !plannedWorkoutOnDate(deps.workouts, d));
  if (restDates.length === 0) {
    Alert.alert('No rest day', 'Every other day this week already has a workout.');
    return;
  }
  Alert.alert('Swap with rest day', 'Choose a rest day to exchange with', [
    ...restDates.map((date) => ({
      text: formatDayShort(date),
      onPress: () => void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate: date }),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function promptDoToday(deps: PlanDayActionDeps, today: string) {
  const others = plannedWorkoutsThisWeek(deps.workouts).filter((w) => w.scheduledDate !== today);
  promptPickWorkout('Do today', 'Move which workout to today?', others, (workout) => {
    void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate: today });
  });
}

/** Home screen — Manage Day menu for today. */
export function showHomeManageDayMenu(deps: PlanDayActionDeps, today = localDateString()) {
  const week = plannedWorkoutsThisWeek(deps.workouts);
  const todayWorkout = plannedWorkoutOnDate(deps.workouts, today);
  const tomorrow = addDays(today, 1);
  const otherWorkouts = week.filter((w) => w.scheduledDate !== today);

  type AlertOption = { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void };
  const options: AlertOption[] = [];

  if (!todayWorkout && otherWorkouts.length > 0) {
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
  } else if (otherWorkouts.length > 0) {
    options.push({ text: 'Swap With Rest Day', onPress: () => promptDoToday(deps, today) });
  }

  if (options.length === 0) {
    Alert.alert('Manage Day', 'No planned workouts this week to adjust.');
    return;
  }

  Alert.alert(
    'Manage Day',
    todayWorkout ? todayWorkout.name : 'Today is a rest day — bring a workout forward or swap days.',
    [...options, { text: 'Cancel', style: 'cancel' }],
  );
}

/** Weekly planner — Edit Day menu for a specific date. */
export function showWeeklyEditDayMenu(
  deps: PlanDayActionDeps,
  date: string,
  onStartWorkout?: () => void,
) {
  const dayWorkout = plannedWorkoutOnDate(deps.workouts, date);
  const otherWorkouts = plannedWorkoutsThisWeek(deps.workouts).filter((w) => w.scheduledDate !== date);

  type AlertOption = { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void };
  const options: AlertOption[] = [];

  if (dayWorkout) {
    options.push({ text: 'Move', onPress: () => promptMoveToDay(deps, dayWorkout) });
    options.push({ text: 'Swap', onPress: () => promptSwapWithWorkout(deps, dayWorkout) });
    options.push({
      text: 'Make Rest Day',
      style: 'destructive',
      onPress: () => confirmSkip(deps, dayWorkout),
    });
    if (onStartWorkout) {
      options.push({ text: 'Start Workout', onPress: onStartWorkout });
    }
  } else {
    if (otherWorkouts.length > 0) {
      options.push({
        text: 'Move',
        onPress: () =>
          promptPickWorkout('Move workout here', formatDayShort(date), otherWorkouts, (workout) => {
            void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate: date });
          }),
      });
      options.push({
        text: 'Swap',
        onPress: () =>
          promptPickWorkout('Swap onto this day', formatDayShort(date), otherWorkouts, (workout) => {
            void executeAdapt(deps, { type: 'move', workoutId: workout.id, toDate: date });
          }),
      });
    }
    if (onStartWorkout) {
      options.push({ text: 'Start Workout', onPress: onStartWorkout });
    }
  }

  if (options.length === 0) {
    Alert.alert('Edit Day', 'No workouts available to move this week.');
    return;
  }

  Alert.alert('Edit Day', formatDayShort(date), [...options, { text: 'Cancel', style: 'cancel' }]);
}

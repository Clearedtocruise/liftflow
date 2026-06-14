import { localDateString } from '@/lib/localDate';
import { estimateWorkoutDurationMinutes, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export type WeekDayPlan = {
  date: string;
  dayLabel: (typeof WEEKDAY_LABELS)[number];
  workout: PlannedWorkout | null;
  isRestDay: boolean;
};

export function getWeekRange(
  reference = new Date(),
  timeZone?: string | null,
): { from: string; to: string; dates: string[] } {
  const start = new Date(reference);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setHours(0, 0, 0, 0);
  start.setDate(diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(localDateString(d, timeZone));
  }

  return { from: dates[0], to: dates[6], dates };
}

export type WeeklyPlanEntry = {
  day: (typeof WEEKDAY_LABELS)[number];
  date: string;
  title: string;
  workoutId: string | null;
  isRestDay: boolean;
};

const PLANNED_STATUS_PRIORITY: Record<string, number> = {
  planned: 3,
  in_progress: 2,
  completed: 1,
  cancelled: 0,
};

/** One canonical planned workout per calendar day (handles duplicate DB rows). */
export function dedupePlannedWorkoutsByDate(
  plannedWorkouts: PlannedWorkout[],
  reference = new Date(),
  timeZone?: string | null,
): PlannedWorkout[] {
  const { dates } = getWeekRange(reference, timeZone);
  const weekDates = new Set(dates);
  const byDate = new Map<string, PlannedWorkout>();

  for (const workout of plannedWorkouts) {
    if (!weekDates.has(workout.scheduledDate)) continue;

    const existing = byDate.get(workout.scheduledDate);
    if (!existing) {
      byDate.set(workout.scheduledDate, workout);
      continue;
    }

    const existingRank = PLANNED_STATUS_PRIORITY[existing.status] ?? 0;
    const nextRank = PLANNED_STATUS_PRIORITY[workout.status] ?? 0;
    if (nextRank > existingRank) {
      byDate.set(workout.scheduledDate, workout);
      continue;
    }
    if (nextRank < existingRank) continue;

    const existingExercises = existing.metadata?.exercises?.length ?? 0;
    const nextExercises = workout.metadata?.exercises?.length ?? 0;
    if (nextExercises > existingExercises) {
      byDate.set(workout.scheduledDate, workout);
    }
  }

  return dates.map((date) => byDate.get(date)).filter((workout): workout is PlannedWorkout => workout != null);
}

export function workoutScheduleTitle(workout: PlannedWorkout): string {
  const slot = workout.metadata?.slotLabel?.trim();
  if (slot) return slot;
  const dayLabel = workout.metadata?.dayLabel?.trim();
  if (dayLabel) return dayLabel;
  const groups = workout.suggestedMuscleGroups?.filter(Boolean) ?? [];
  if (groups.length > 0) return groups.join(' · ');
  const shortName = workout.name.split('—')[0]?.trim();
  return shortName || workout.name;
}

export function buildWeeklyPlanEntries(
  plannedWorkouts: PlannedWorkout[],
  reference = new Date(),
  timeZone?: string | null,
): WeeklyPlanEntry[] {
  const { dates } = getWeekRange(reference, timeZone);
  const deduped = dedupePlannedWorkoutsByDate(plannedWorkouts, reference, timeZone);
  const byDate = new Map(deduped.map((workout) => [workout.scheduledDate, workout]));

  return dates.map((date, index) => {
    const workout = byDate.get(date);
    const isRestDay = !workout || workout.status !== 'planned';
    return {
      day: WEEKDAY_LABELS[index],
      date,
      title: workout && !isRestDay ? workoutScheduleTitle(workout) : 'Rest',
      workoutId: workout && !isRestDay ? workout.id : null,
      isRestDay,
    };
  });
}

export function buildWeekPlan(
  plannedWorkouts: PlannedWorkout[],
  reference = new Date(),
  timeZone?: string | null,
): WeekDayPlan[] {
  const { dates } = getWeekRange(reference, timeZone);
  const deduped = dedupePlannedWorkoutsByDate(plannedWorkouts, reference, timeZone);
  const byDate = new Map(deduped.map((workout) => [workout.scheduledDate, workout]));

  return dates.map((date, index) => {
    const workout = byDate.get(date) ?? null;
    const isPlanned = workout?.status === 'planned';
    return {
      date,
      dayLabel: WEEKDAY_LABELS[index],
      workout: isPlanned ? workout : null,
      isRestDay: !isPlanned,
    };
  });
}

export function restDayLabel(_dayLabel: (typeof WEEKDAY_LABELS)[number]): string {
  return 'Rest Day';
}

export function workoutMuscleGroups(workout: PlannedWorkout): string {
  const groups = workout.suggestedMuscleGroups ?? [];
  if (groups.length > 0) {
    return groups.join(' · ');
  }
  return workout.metadata?.dayLabel ?? 'Full body';
}

export function workoutExerciseCount(workout: PlannedWorkout): number {
  return workout.metadata?.exercises?.length ?? 0;
}

export function workoutTotalSets(workout: PlannedWorkout): number {
  return exercisesFromPlannedWorkout(workout).reduce((total, exercise) => total + Math.max(exercise.sets, 0), 0);
}

export function workoutDurationMinutes(workout: PlannedWorkout): number {
  return estimateWorkoutDurationMinutes(exercisesFromPlannedWorkout(workout));
}

export function workoutExerciseSummary(workout: PlannedWorkout, max = 4): string {
  const names = exercisesFromPlannedWorkout(workout).map((exercise) => exercise.name);
  if (names.length === 0) return 'Exercises syncing';
  const shown = names.slice(0, max).join(', ');
  if (names.length > max) return `${shown}, +${names.length - max} more`;
  return shown;
}

export function isToday(date: string, timeZone?: string | null): boolean {
  return date === localDateString(new Date(), timeZone);
}

export function isConditioningWorkout(workout: PlannedWorkout): boolean {
  if (workout.metadata?.sessionKind === 'cardio') return true;
  const label = `${workout.name} ${workout.metadata?.slotLabel ?? ''}`.toLowerCase();
  return label.includes('condition') || label.includes('cardio') || label.includes('hiit');
}

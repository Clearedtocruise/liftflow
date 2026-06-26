import { addCalendarDays, localDateString, weekStartFromDateString } from '@/lib/localDate';
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
  const anchor = localDateString(reference, timeZone);
  const from = weekStartFromDateString(anchor);
  const dates = Array.from({ length: 7 }, (_, index) => addCalendarDays(from, index));
  return { from, to: dates[6]!, dates };
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

/** When two planned rows share a date, pick the more authoritative one. */
function isPreferredPlannedWorkout(candidate: PlannedWorkout, incumbent: PlannedWorkout): boolean {
  const candidateRescheduled = candidate.metadata?.rescheduledAt ?? '';
  const incumbentRescheduled = incumbent.metadata?.rescheduledAt ?? '';
  if (candidateRescheduled !== incumbentRescheduled) {
    if (candidateRescheduled && !incumbentRescheduled) return true;
    if (!candidateRescheduled && incumbentRescheduled) return false;
    return candidateRescheduled > incumbentRescheduled;
  }

  const candidateCreated = candidate.createdAt ?? '';
  const incumbentCreated = incumbent.createdAt ?? '';
  if (candidateCreated !== incumbentCreated) {
    return candidateCreated > incumbentCreated;
  }

  const candidateExercises = candidate.metadata?.exercises?.length ?? 0;
  const incumbentExercises = incumbent.metadata?.exercises?.length ?? 0;
  return candidateExercises > incumbentExercises;
}

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

    if (isPreferredPlannedWorkout(workout, existing)) {
      byDate.set(workout.scheduledDate, workout);
    }
  }

  return dates.map((date) => byDate.get(date)).filter((workout): workout is PlannedWorkout => workout != null);
}

function rescheduleStamp(workout: PlannedWorkout): string {
  return workout.metadata?.rescheduledAt ?? workout.updatedAt ?? workout.createdAt ?? '';
}

/** Keep optimistic local patches when a background refetch returns stale schedule rows. */
export function mergePlannedWorkoutsPreferringReschedule(
  local: PlannedWorkout[],
  remote: PlannedWorkout[],
  reference = new Date(),
  timeZone?: string | null,
): PlannedWorkout[] {
  const byId = new Map(remote.map((workout) => [workout.id, workout]));

  for (const workout of local) {
    const existing = byId.get(workout.id);
    if (!existing) {
      byId.set(workout.id, workout);
      continue;
    }
    if (rescheduleStamp(workout) >= rescheduleStamp(existing)) {
      byId.set(workout.id, workout);
    }
  }

  return dedupePlannedWorkoutsByDate([...byId.values()], reference, timeZone);
}

/** Apply a schedule change to the in-memory week list (instant UI before network confirm). */
export function patchPlannedWorkoutsForChange(
  workouts: PlannedWorkout[],
  change: import('@/types/planAdaptation').ScheduleChange,
): PlannedWorkout[] {
  const stamp = new Date().toISOString();

  const withReschedule = (workout: PlannedWorkout, scheduledDate: string, fromDate: string): PlannedWorkout => ({
    ...workout,
    scheduledDate,
    metadata: {
      ...workout.metadata,
      rescheduledFrom: fromDate,
      rescheduledAt: stamp,
    },
  });

  switch (change.type) {
    case 'swap': {
      const a = workouts.find((w) => w.id === change.workoutIdA);
      const b = workouts.find((w) => w.id === change.workoutIdB);
      if (!a || !b) return workouts;
      const dateA = a.scheduledDate;
      const dateB = b.scheduledDate;
      return workouts.map((w) => {
        if (w.id === a.id) return withReschedule(w, dateB, dateA);
        if (w.id === b.id) return withReschedule(w, dateA, dateB);
        return w;
      });
    }
    case 'move': {
      const moving = workouts.find((w) => w.id === change.workoutId);
      if (!moving) return workouts;
      const fromDate = moving.scheduledDate;
      const toDate = change.toDate;
      const occupant = workouts.find(
        (w) => w.scheduledDate === toDate && w.status === 'planned' && w.id !== moving.id,
      );
      return workouts.map((w) => {
        if (w.id === moving.id) return withReschedule(w, toDate, fromDate);
        if (occupant && w.id === occupant.id) return withReschedule(w, fromDate, toDate);
        return w;
      });
    }
    case 'skip':
      return workouts.map((w) =>
        w.id === change.workoutId ? { ...w, status: 'cancelled' as const } : w,
      );
    default:
      return workouts;
  }
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

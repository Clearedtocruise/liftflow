import { estimateWorkoutDurationMinutes, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export type WeekDayPlan = {
  date: string;
  dayLabel: (typeof WEEKDAY_LABELS)[number];
  workout: PlannedWorkout | null;
  isRestDay: boolean;
};

export function getWeekRange(reference = new Date()): { from: string; to: string; dates: string[] } {
  const start = new Date(reference);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setHours(0, 0, 0, 0);
  start.setDate(diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return { from: dates[0], to: dates[6], dates };
}

export function buildWeekPlan(plannedWorkouts: PlannedWorkout[], reference = new Date()): WeekDayPlan[] {
  const { dates } = getWeekRange(reference);
  const byDate = new Map(plannedWorkouts.map((workout) => [workout.scheduledDate, workout]));

  return dates.map((date, index) => {
    const workout = byDate.get(date) ?? null;
    return {
      date,
      dayLabel: WEEKDAY_LABELS[index],
      workout,
      isRestDay: !workout,
    };
  });
}

export function restDayLabel(dayLabel: (typeof WEEKDAY_LABELS)[number]): string {
  if (dayLabel === 'Saturday') return 'Conditioning or Recovery';
  if (dayLabel === 'Sunday') return 'Rest or Mobility';
  return 'Rest / Mobility';
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

export function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

export function isConditioningWorkout(workout: PlannedWorkout): boolean {
  if (workout.metadata?.sessionKind === 'cardio') return true;
  const label = `${workout.name} ${workout.metadata?.slotLabel ?? ''}`.toLowerCase();
  return label.includes('condition') || label.includes('cardio') || label.includes('hiit');
}

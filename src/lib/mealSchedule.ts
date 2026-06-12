import type { MealType } from '@/types/common';
import type { UserProfile } from '@/types/user';

export type ScheduleInput = {
  wakeHour?: number;
  sleepHour?: number;
  workoutHour?: number;
  mealsPerDay?: number;
};

const WORKOUT_TIME_HOURS: Record<string, number> = {
  early_morning: 5,
  morning: 9,
  midday: 12,
  afternoon: 15,
  evening: 18,
  night: 20,
};

export function scheduleFromProfile(user: UserProfile | null, hasWorkoutToday: boolean): ScheduleInput {
  const coach = user?.metadata?.coachProfile;
  const workoutPref = coach?.preferredWorkoutTimes?.[0];
  return {
    wakeHour: 4,
    sleepHour: 21,
    workoutHour: workoutPref ? WORKOUT_TIME_HOURS[workoutPref] ?? 9 : 9,
    mealsPerDay: coach?.mealsPerDay ?? 5,
  };
}

function formatHour(hour: number, minute = 0): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export function scheduledTimesForDay(
  mealTypes: MealType[],
  schedule: ScheduleInput,
  hasWorkoutToday: boolean,
): string[] {
  const wake = schedule.wakeHour ?? 6;
  const workout = schedule.workoutHour ?? 9;
  const count = mealTypes.length;

  if (hasWorkoutToday && count >= 4) {
    const workoutSlots = [
      formatHour(wake, 15),
      formatHour(workout + 1, 30),
      formatHour(wake + 6, 0),
      formatHour(wake + 9, 0),
      formatHour(wake + 12, 0),
      formatHour(wake + 15, 0),
    ];
    return workoutSlots.slice(0, count);
  }

  const windowHours = Math.max(10, (schedule.sleepHour ?? 21) - wake - 2);
  const step = windowHours / Math.max(count - 1, 1);
  const slots: string[] = [];
  for (let i = 0; i < count; i += 1) {
    slots.push(formatHour(wake + Math.round(i * step), i === 0 ? 15 : 0));
  }
  return slots;
}

export function formatWorkoutTime(schedule: ScheduleInput): string {
  return formatHour(schedule.workoutHour ?? 9, 0);
}

export function mealTypeLabel(type: MealType): string {
  switch (type) {
    case 'pre_workout':
      return 'Pre-workout fuel';
    case 'post_workout':
      return 'Post-workout recovery';
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    case 'snack':
      return 'Snack';
    default:
      return 'Meal';
  }
}

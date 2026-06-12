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

const WAKE_HOUR_BY_WORKOUT_PREF: Record<string, number> = {
  early_morning: 4,
  morning: 6,
  midday: 7,
  afternoon: 8,
  evening: 9,
  night: 10,
};

const SLEEP_HOUR_BY_WORKOUT_PREF: Record<string, number> = {
  early_morning: 21,
  morning: 22,
  midday: 22,
  afternoon: 22,
  evening: 22,
  night: 23,
};

function formatHour(hour: number, minute = 0): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

function workoutPref(user: UserProfile | null): string | undefined {
  return user?.metadata?.coachProfile?.preferredWorkoutTimes?.[0];
}

export function scheduleFromProfile(
  user: UserProfile | null,
  hasWorkoutToday: boolean,
  recoverySleepHours?: number,
): ScheduleInput {
  const pref = workoutPref(user);
  const coach = user?.metadata?.coachProfile;
  let wakeHour = pref ? (WAKE_HOUR_BY_WORKOUT_PREF[pref] ?? 6) : 6;
  let sleepHour = pref ? (SLEEP_HOUR_BY_WORKOUT_PREF[pref] ?? 21) : 21;

  if (recoverySleepHours != null && recoverySleepHours > 0 && recoverySleepHours < 7) {
    sleepHour = Math.max(20, sleepHour - 1);
  }

  if (recoverySleepHours != null && recoverySleepHours >= 8) {
    sleepHour = Math.min(23, sleepHour + 1);
  }

  return {
    wakeHour,
    sleepHour,
    workoutHour: pref ? (WORKOUT_TIME_HOURS[pref] ?? 9) : 9,
    mealsPerDay: coach?.mealsPerDay ?? 5,
  };
}

export function formatScheduleSubtitle(schedule: ScheduleInput): string {
  const wake = formatHour(schedule.wakeHour ?? 6, 0);
  const workout = formatHour(schedule.workoutHour ?? 9, 0);
  const sleep = formatHour(schedule.sleepHour ?? 21, 0);
  return `Wake ~${wake} · Workout ~${workout} · Sleep ~${sleep}`;
}

export function scheduledTimesForDay(
  mealTypes: import('@/types/common').MealType[],
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

export function mealTypeLabel(type: import('@/types/common').MealType): string {
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

import type * as Notifications from 'expo-notifications';

import { isAppForeground } from '@/lib/appForeground';

export const WORKOUT_NOTIFICATION_ID = 'active-workout-session';

/** Set while a workout is active and the app is in the foreground. */
let foregroundWorkoutActive = false;

export function setForegroundWorkoutActive(active: boolean): void {
  foregroundWorkoutActive = active;
}

export function isForegroundWorkoutActive(): boolean {
  return foregroundWorkoutActive;
}

/** Detect workout-progress local/push notifications even if data.type is missing. */
export function isWorkoutProgressNotification(notification: Notifications.Notification): boolean {
  const { identifier, content } = notification.request;
  const type = content.data?.type;

  if (type === 'workout_session') return true;
  if (identifier === WORKOUT_NOTIFICATION_ID) return true;

  const body = typeof content.body === 'string' ? content.body : '';
  const title = typeof content.title === 'string' ? content.title : '';

  if (/Exercise\s+\d+\s*\/\s*\d+/i.test(body)) return true;
  if (/\d+:\d{2}/.test(title) && title.includes('•')) return true;

  return false;
}

export function shouldSuppressWorkoutNotification(notification: Notifications.Notification): boolean {
  if (!isWorkoutProgressNotification(notification)) return false;
  return isAppForeground() || foregroundWorkoutActive;
}

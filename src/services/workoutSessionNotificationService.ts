import * as Notifications from 'expo-notifications';

import {
    isWorkoutProgressNotification,
    WORKOUT_NOTIFICATION_ID,
} from '@/lib/workoutNotificationGuard';

/**
 * Clears any workout-progress notifications from the tray and scheduler.
 * Scheduling is intentionally disabled — local notifications were popping
 * in the foreground and triggering iOS "stop workout" prompts.
 */
export const workoutSessionNotificationService = {
  async clearPresented(): Promise<void> {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      await Promise.all(
        presented
          .filter(isWorkoutProgressNotification)
          .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
      );
    } catch {
      /* tray unavailable */
    }
  },

  async clear(): Promise<void> {
    await this.clearPresented();
    try {
      await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID);
    } catch {
      /* not delivered */
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID);
    } catch {
      /* not scheduled */
    }
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => {
            if (n.identifier === WORKOUT_NOTIFICATION_ID) return true;
            const body = typeof n.content.body === 'string' ? n.content.body : '';
            return /Exercise\s+\d+\s*\/\s*\d+/i.test(body);
          })
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
    } catch {
      /* scheduler unavailable */
    }
  },

  /** No-op — kept so callers can clear without scheduling. */
  async sync(): Promise<void> {
    await this.clear();
  },
};

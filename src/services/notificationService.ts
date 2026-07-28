import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { localDateString } from '@/lib/localDate';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

type NotificationsModule = typeof import('expo-notifications');

const WORKOUT_REMINDER_TYPE = 'workout_reminder';
const WORKOUT_REMINDER_ID = 'one-more-daily-workout-reminder';

let notificationsModule: NotificationsModule | null = null;
let handlerConfigured = false;
let initAttempted = false;

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationsModule) return notificationsModule;
  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch {
    return null;
  }
}

/** Safe to call after app mount — never runs at module import time. */
export async function initializeNotificationsSafely(): Promise<boolean> {
  if (initAttempted && handlerConfigured) return true;
  initAttempted = true;

  const Notifications = await loadNotificationsModule();
  if (!Notifications || handlerConfigured) return handlerConfigured;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
    return true;
  } catch {
    return false;
  }
}

async function getProjectId(): Promise<string | undefined> {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

function permissionsGranted(
  Notifications: NotificationsModule,
  perm: NotificationsModule['NotificationPermissionsStatus'],
): boolean {
  if (Platform.OS === 'android') return true;
  const status = perm.ios?.status;
  return (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function isWorkoutReminder(notification: {
  identifier?: string;
  content?: { data?: Record<string, unknown> };
}): boolean {
  if (notification.identifier === WORKOUT_REMINDER_ID) return true;
  return notification.content?.data?.type === WORKOUT_REMINDER_TYPE;
}

function nextReminderDate(hour: number, minute: number, skipToday: boolean): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const now = new Date();
  if (skipToday || next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function hasCompletedWorkoutOnLocalDate(userId: string, date = localDateString()): Promise<boolean> {
  try {
    // Look back ~36h of completions and compare in local calendar time
    // so timezone edges don't miss or double-count "today".
    const since = new Date();
    since.setDate(since.getDate() - 1);

    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, ended_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('ended_at', since.toISOString())
      .order('ended_at', { ascending: false })
      .limit(10);

    if (error) return false;
    return (data ?? []).some((row) => {
      if (!row.ended_at) return false;
      return localDateString(new Date(row.ended_at)) === date;
    });
  } catch {
    return false;
  }
}

export const notificationService = {
  initializeNotificationsSafely,

  async requestPermissions(): Promise<ServiceResult<boolean>> {
    if (!Device.isDevice) {
      return fail('Push notifications require a physical device.');
    }

    try {
      const ready = await initializeNotificationsSafely();
      const Notifications = await loadNotificationsModule();
      if (!ready || !Notifications) return fail('Notifications unavailable');

      const existing = await Notifications.getPermissionsAsync();
      if (permissionsGranted(Notifications, existing)) return ok(true);

      const requested = await Notifications.requestPermissionsAsync();
      if (!permissionsGranted(Notifications, requested)) {
        return fail('Notification permission denied');
      }
      return ok(true);
    } catch (e) {
      return fromError(e);
    }
  },

  async getExpoPushToken(): Promise<ServiceResult<string>> {
    try {
      const perm = await this.requestPermissions();
      if (!perm.success) return fail(perm.error);

      const Notifications = await loadNotificationsModule();
      if (!Notifications) return fail('Notifications unavailable');

      const projectId = await getProjectId();
      const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return ok(tokenData.data);
    } catch (e) {
      return fromError(e);
    }
  },

  /** Skipped when push entitlement is absent — local reminders only for now. */
  async registerDevice(_userId: string): Promise<ServiceResult<void>> {
    return ok(undefined);
  },

  async cancelWorkoutReminders(): Promise<ServiceResult<number>> {
    try {
      const ready = await initializeNotificationsSafely();
      const Notifications = await loadNotificationsModule();
      if (!ready || !Notifications) return fail('Notifications unavailable');

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      let cancelled = 0;
      for (const item of scheduled) {
        if (!isWorkoutReminder(item)) continue;
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
        cancelled += 1;
      }
      return ok(cancelled);
    } catch (e) {
      return fromError(e);
    }
  },

  /**
   * Ensures exactly one workout reminder exists.
   * Cancels duplicates first (fixes stacked DAILY schedules from remounts).
   * When today's workout is already done, schedules the next fire for tomorrow.
   */
  async scheduleWorkoutReminder(
    hour: number,
    minute: number,
    options?: { skipToday?: boolean; userId?: string },
  ): Promise<ServiceResult<string>> {
    try {
      const ready = await initializeNotificationsSafely();
      const Notifications = await loadNotificationsModule();
      if (!ready || !Notifications) return fail('Notifications unavailable');

      let skipToday = options?.skipToday ?? false;
      if (!skipToday && options?.userId) {
        skipToday = await hasCompletedWorkoutOnLocalDate(options.userId);
      }

      await this.cancelWorkoutReminders();

      const nextFire = nextReminderDate(hour, minute, skipToday);
      const useDaily = !skipToday && nextFire.toDateString() === new Date().toDateString();

      const id = await Notifications.scheduleNotificationAsync({
        identifier: WORKOUT_REMINDER_ID,
        content: {
          title: 'Time to train',
          body: 'Your ONE MORE workout is waiting. Log your session today.',
          data: { type: WORKOUT_REMINDER_TYPE },
        },
        trigger: useDaily
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextFire,
            },
      });
      return ok(id);
    } catch (e) {
      return fromError(e);
    }
  },

  /** After finishing a workout, suppress today's reminder and arm tomorrow. */
  async rescheduleAfterWorkoutCompleted(hour = 18, minute = 0): Promise<ServiceResult<string>> {
    return this.scheduleWorkoutReminder(hour, minute, { skipToday: true });
  },

  async addNotificationReceivedListener(listener: (notification: unknown) => void) {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return { remove: () => undefined };
    return Notifications.addNotificationReceivedListener(listener as never);
  },

  async addNotificationResponseListener(listener: (response: unknown) => void) {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return { remove: () => undefined };
    return Notifications.addNotificationResponseReceivedListener(listener as never);
  },
};

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { fail, fromError, ok } from '@/lib/serviceResult';
import type { ServiceResult } from '@/types/common';

type NotificationsModule = typeof import('expo-notifications');

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
  perm: Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>,
): boolean {
  if (Platform.OS === 'android') return true;
  const status = perm.ios?.status;
  return (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
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

  async scheduleWorkoutReminder(hour: number, minute: number): Promise<ServiceResult<string>> {
    try {
      const ready = await initializeNotificationsSafely();
      const Notifications = await loadNotificationsModule();
      if (!ready || !Notifications) return fail('Notifications unavailable');

      await this.cancelWorkoutReminders();

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to train',
          body: 'Your ONE MORE workout is waiting. Log your session today.',
          data: { type: 'workout_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      return ok(id);
    } catch (e) {
      return fromError(e);
    }
  },

  async cancelWorkoutReminders(): Promise<void> {
    try {
      const Notifications = await loadNotificationsModule();
      if (!Notifications) return;

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((item) => (item.content.data as { type?: string })?.type === 'workout_reminder')
          .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
      );
    } catch {
      // Non-fatal
    }
  },

  async syncWorkoutReminder(enabled: boolean, hour = 18, minute = 0): Promise<ServiceResult<void>> {
    if (!enabled) {
      await this.cancelWorkoutReminders();
      return ok(undefined);
    }
    const result = await this.scheduleWorkoutReminder(hour, minute);
    if (!result.success) return fail(result.error);
    return ok(undefined);
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

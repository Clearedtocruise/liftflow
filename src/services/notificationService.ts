import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken, supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getProjectId(): Promise<string | undefined> {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

function permissionsGranted(perm: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === 'android') return true;
  const status = perm.ios?.status;
  return status === Notifications.IosAuthorizationStatus.AUTHORIZED || status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export const notificationService = {
  async requestPermissions(): Promise<ServiceResult<boolean>> {
    if (!Device.isDevice) {
      return fail('Push notifications require a physical device.');
    }

    try {
      const existing = await Notifications.getPermissionsAsync();
      if (permissionsGranted(existing)) return ok(true);

      const requested = await Notifications.requestPermissionsAsync();
      if (!permissionsGranted(requested)) {
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

      const projectId = await getProjectId();
      const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return ok(tokenData.data);
    } catch (e) {
      return fromError(e);
    }
  },

  async registerDevice(userId: string): Promise<ServiceResult<void>> {
    // Provisioning profile is local-notifications-only (no aps-environment).
    // Skip remote push registration on iOS until Push capability is enabled in ASC.
    if (Platform.OS === 'ios') {
      return ok(undefined);
    }

    try {
      const tokenResult = await this.getExpoPushToken();
      if (!tokenResult.success) return fail(tokenResult.error);

      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

      const { error } = await supabase.from('user_devices').insert({
        user_id: userId,
        device_token: tokenResult.data,
        platform,
        device_name: Device.modelName ?? Device.deviceName ?? 'Unknown',
        is_active: true,
        last_seen_at: new Date().toISOString(),
      });

      if (error && !error.message.includes('duplicate')) {
        return fail(error.message);
      }

      const accessToken = await getAccessToken();
      await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com'}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ deviceToken: tokenResult.data, platform }),
      });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'ONE MORE',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async scheduleWorkoutReminder(hour: number, minute: number): Promise<ServiceResult<string>> {
    try {
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

  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  },

  addNotificationResponseListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  },
};

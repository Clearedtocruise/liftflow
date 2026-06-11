import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import { isAppForeground } from '@/lib/appForeground';
import { shouldSuppressWorkoutNotification } from '@/lib/workoutNotificationGuard';
import { workoutSessionNotificationService } from '@/services/workoutSessionNotificationService';

const HIDE = {
  shouldShowAlert: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
  shouldShowBanner: false,
  shouldShowList: false,
} as const;

const SHOW = {
  shouldShowAlert: true,
  shouldPlaySound: true,
  shouldSetBadge: true,
  shouldShowBanner: true,
  shouldShowList: true,
} as const;

let initialized = false;

/** Register notification handlers after the app shell mounts (see AppProviders). */
export function initNotifications(): void {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      if (shouldSuppressWorkoutNotification(notification) || isAppForeground()) {
        void workoutSessionNotificationService.clearPresented();
        return HIDE;
      }
      return SHOW;
    },
  });

  Notifications.addNotificationReceivedListener((notification) => {
    if (shouldSuppressWorkoutNotification(notification) || isAppForeground()) {
      void workoutSessionNotificationService.clearPresented();
    }
  });

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void workoutSessionNotificationService.clear();
    }
  });

}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { PRODUCT_EVENTS, type ProductEventName, type ProductEventProperties } from '@/lib/analytics/productEvents';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

let sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function appVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
}

function appEnvironment(): string {
  return __DEV__ ? 'development' : 'production';
}

export const productAnalyticsService = {
  resetSession(): void {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  },

  async track(userId: string | undefined, eventName: ProductEventName, properties: ProductEventProperties = {}) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/events/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          sessionId,
          eventName,
          properties,
          appVersion: appVersion(),
          appEnvironment: appEnvironment(),
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Analytics track failed');
      }

      return ok(true);
    } catch (e) {
      return fromError(e);
    }
  },

  trackOnboardingCompleted(userId: string) {
    return this.track(userId, PRODUCT_EVENTS.ONBOARDING_COMPLETED);
  },

  trackWorkoutCompleted(userId: string, sessionId?: string) {
    return this.track(userId, PRODUCT_EVENTS.WORKOUT_COMPLETED, { sessionId: sessionId ?? '' });
  },

  trackVoiceLog(userId: string, intent?: string) {
    return this.track(userId, PRODUCT_EVENTS.VOICE_LOG_USED, { intent: intent ?? 'log_set' });
  },

  trackAiCoach(userId: string, context?: string) {
    return this.track(userId, PRODUCT_EVENTS.AI_COACH_USED, { context: context ?? 'general' });
  },

  trackRecovery(userId: string) {
    return this.track(userId, PRODUCT_EVENTS.RECOVERY_VIEWED);
  },

  trackNutrition(userId: string) {
    return this.track(userId, PRODUCT_EVENTS.NUTRITION_VIEWED);
  },

  trackTransformation(userId: string, targetBf?: number) {
    return this.track(userId, PRODUCT_EVENTS.TRANSFORMATION_RUN, { targetBf: targetBf ?? 0 });
  },

  trackPeakMusic(userId: string, intent?: string) {
    return this.track(userId, PRODUCT_EVENTS.PEAK_MUSIC_USED, { intent: intent ?? 'unknown' });
  },

  trackWatchSync(userId: string) {
    return this.track(userId, PRODUCT_EVENTS.WATCH_SYNC_USED);
  },

  trackSubscription(userId: string, event: 'started' | 'converted') {
    return this.track(
      userId,
      event === 'started' ? PRODUCT_EVENTS.SUBSCRIPTION_STARTED : PRODUCT_EVENTS.SUBSCRIPTION_CONVERTED,
    );
  },

  trackFeedback(userId: string, type: string) {
    return this.track(userId, PRODUCT_EVENTS.FEEDBACK_SUBMITTED, { type });
  },
};

export { PRODUCT_EVENTS };

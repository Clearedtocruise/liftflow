/**
 * Sprint 8.5 — Product analytics event definitions
 * @see docs/PRODUCT_ANALYTICS_EVENTS.md
 */

export const PRODUCT_EVENTS = {
  ONBOARDING_COMPLETED: 'onboarding_completed',
  WORKOUT_COMPLETED: 'workout_completed',
  VOICE_LOG_USED: 'voice_log_used',
  AI_COACH_USED: 'ai_coach_used',
  RECOVERY_VIEWED: 'recovery_viewed',
  NUTRITION_VIEWED: 'nutrition_viewed',
  TRANSFORMATION_RUN: 'transformation_run',
  PEAK_MUSIC_USED: 'peak_music_used',
  WATCH_SYNC_USED: 'watch_sync_used',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CONVERTED: 'subscription_converted',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
} as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

export type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;

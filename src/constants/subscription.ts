/** App Store / Play Store subscription product configuration (Pro tier) */
export const SUBSCRIPTION = {
  /** Display fallback — live price comes from RevenueCat offerings */
  displayPrice: '$9.99',
  billingPeriod: 'month',
  /** Apple App Store product identifier — create in App Store Connect */
  appleProductId: 'com.liftflow.app.premium.monthly',
  /** Google Play product identifier */
  googleProductId: 'liftflow_premium_monthly',
  /** RevenueCat entitlement identifier (create as "pro" in RevenueCat dashboard) */
  entitlementId: 'pro',
  /** Legacy entitlement id — checked as fallback during migration */
  legacyEntitlementId: 'premium',
  /** RevenueCat offering identifier */
  offeringId: 'default',
  /** Supabase tier stored on purchase */
  tier: 'premium' as const,
  /** Product display name */
  planName: 'ONE MORE Pro',
  /** Introductory trial — configure matching offer in App Store Connect + RevenueCat */
  trialDays: 7,
  trialLabel: '7-day free trial',
} as const;

/**
 * Basic tier ($4.99/mo). Unlocks custom day-based programs (1–30 days) with automatic looping,
 * workout/rest days, the exercise library, program editing, workout history, persistent exercise
 * performance, and the persistent/repeating nutrition plan. Pro is a superset of Basic.
 */
export const BASIC_SUBSCRIPTION = {
  displayPrice: '$4.99',
  billingPeriod: 'month',
  /** Apple App Store product identifier — create in App Store Connect */
  appleProductId: 'com.liftflow.app.basic.monthly',
  /** Google Play product identifier */
  googleProductId: 'liftflow_basic_monthly',
  /** RevenueCat entitlement identifier (create as "basic" in RevenueCat dashboard) */
  entitlementId: 'basic',
  /** RevenueCat offering identifier */
  offeringId: 'default',
  /** Supabase tier stored on purchase */
  tier: 'basic' as const,
  planName: 'ONE MORE Basic',
} as const;

/** Basic tier capabilities (also included in Pro). */
export const BASIC_FEATURES = [
  'Custom workout programs up to 30 days',
  'Import workout and nutrition PDFs',
  'Automatic program looping',
  'Workout and rest days',
  'Exercise library access',
  'Add / remove / replace / reorder exercises',
  'Workout history',
  'Persistent exercise performance history',
  'Program editing',
  'Persistent repeating nutrition plan',
] as const;

/**
 * Feature ids unlocked at Basic and above (so a Basic OR Pro subscriber has them). Kept separate
 * from PRO_FEATURE_IDS so Pro-only gating never accidentally treats these as Pro-exclusive.
 */
export const BASIC_FEATURE_IDS = ['custom-programs'] as const;

export type BasicFeatureId = (typeof BASIC_FEATURE_IDS)[number];

/** Free tier capabilities */
export const FREE_FEATURES = [
  'Workout logging',
  'Workout history',
  'Progress tracking',
  'Basic dashboards',
] as const;

/** Pro tier capabilities */
export const PRO_FEATURES = [
  'AI Coach',
  'Recovery Intelligence',
  'Nutrition Intelligence',
  'Smart Progression',
  'Transformation Engine',
  'Peak Music Sync',
  'Advanced Apple Watch features',
] as const;

/** Feature ids used for gating — maps to screens and API surfaces */
export const PRO_FEATURE_IDS = [
  'ai-coach',
  'recovery-intelligence',
  'nutrition-intelligence',
  'smart-progression',
  'transformation-engine',
  'peak-music-sync',
  'apple-watch-advanced',
  'workout-recommendations',
  'voice-coaching',
  'healthkit-sync',
] as const;

export type ProFeatureId = (typeof PRO_FEATURE_IDS)[number];

/** @deprecated use PRO_FEATURE_IDS */
export const PREMIUM_FEATURE_IDS = PRO_FEATURE_IDS;
/** @deprecated use ProFeatureId */
export type PremiumFeatureId = ProFeatureId;

export const PRO_FEATURE_LABELS: Record<ProFeatureId, string> = {
  'ai-coach': 'AI Coach',
  'recovery-intelligence': 'Recovery Intelligence',
  'nutrition-intelligence': 'Nutrition Intelligence',
  'smart-progression': 'Smart Progression',
  'transformation-engine': 'Transformation Engine',
  'peak-music-sync': 'Peak Music Sync',
  'apple-watch-advanced': 'Apple Watch Assistant',
  'workout-recommendations': 'AI Workout Recommendations',
  'voice-coaching': 'Voice Coaching',
  'healthkit-sync': 'Apple Health Sync',
};

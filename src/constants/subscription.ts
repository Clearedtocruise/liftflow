/** App Store / Play Store subscription product configuration */
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

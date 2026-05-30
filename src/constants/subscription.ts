/** App Store / Play Store subscription product configuration */
export const SUBSCRIPTION = {
  /** Display price — must match App Store Connect product ($4.99/month) */
  displayPrice: '$4.99',
  billingPeriod: 'month',
  /** Apple App Store product identifier — create in App Store Connect */
  appleProductId: 'com.liftflow.app.premium.monthly',
  /** Google Play product identifier */
  googleProductId: 'liftflow_premium_monthly',
  /** RevenueCat entitlement identifier */
  entitlementId: 'premium',
  /** RevenueCat offering identifier */
  offeringId: 'default',
  tier: 'premium' as const,
} as const;

/** Features gated behind premium subscription */
export const PREMIUM_FEATURE_IDS = [
  'ai-coaching',
  'suggested-workouts',
  'meal-plans',
  'physique-projections',
  'export-share',
  'healthkit',
  'apple-watch',
] as const;

export type PremiumFeatureId = (typeof PREMIUM_FEATURE_IDS)[number];

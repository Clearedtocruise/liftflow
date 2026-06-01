export * from './ai';
export * from './analytics';
export * from './coachActivation';
export * from './coaching';
export * from './common';
export * from './integrations';
export * from './conversationalCoach';
export * from './nutrition';
export * from './nutritionIntelligence';
export * from './peakMusic';
export * from './progression';
export * from './recoveryIntelligence';
export * from './workoutRecommendation';
export * from './training';
export * from './transformation';
export * from './user';
export * from './voice';
export * from './workout';
export * from './workoutLocation';

/** @deprecated Import from ./user instead */
export type { AuthState, PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from './user';

/** Re-export confirmation mode for settings screen compatibility */
export type { ConfirmationMode } from './common';

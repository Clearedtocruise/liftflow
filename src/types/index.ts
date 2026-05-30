export * from './ai';
export * from './analytics';
export * from './coaching';
export * from './common';
export * from './integrations';
export * from './nutrition';
export * from './platform';
export * from './training';
export * from './user';
export * from './workout';
export * from './workoutLocation';

/** @deprecated Import from ./user instead */
export type { AuthState, PasswordResetPayload, SignInPayload, SignUpPayload, UserProfile } from './user';

/** Re-export confirmation mode for settings screen compatibility */
export type { ConfirmationMode } from './common';

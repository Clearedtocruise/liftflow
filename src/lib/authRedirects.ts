import * as Linking from 'expo-linking';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

/** Stable HTTPS URL for email confirmation links (works in iPhone Safari). */
export function getEmailConfirmRedirectUrl(): string {
  return process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL ?? `${API_BASE}/auth/confirm`;
}

/** Stable HTTPS URL for password reset links opened from email on mobile. */
export function getPasswordResetRedirectUrl(): string {
  return process.env.EXPO_PUBLIC_AUTH_RESET_URL ?? `${API_BASE}/auth/reset-password`;
}

/** Deep link used by hosted auth pages to reopen the native app. */
export function getAppAuthDeepLink(path: string): string {
  return Linking.createURL(path);
}

export const AUTH_REDIRECT_ALLOW_LIST = [
  `${API_BASE}/auth/confirm`,
  `${API_BASE}/auth/reset-password`,
  'liftflow://**',
  'exp://**',
] as const;

/**
 * Why a coach prescription request failed.
 *
 * The API client used to throw a bare Error, so a 403 paywall and a dropped connection arrived
 * identically and the card offered "Retry coach" against both — one of which can never succeed.
 */

export type CoachFailureKind = 'none' | 'entitlement' | 'transient';

/** Matches the backend's `PRO_REQUIRED` refusal from `requireProSubscription`. */
export const PRO_REQUIRED_CODE = 'PRO_REQUIRED';

export function classifyCoachFailure(result: {
  success: boolean;
  error?: string;
  code?: string;
}): CoachFailureKind {
  if (result.success) return 'none';
  if (result.code === PRO_REQUIRED_CODE) return 'entitlement';
  // Older backends answered without a code, so the message is the only signal left.
  if (result.error && /pro subscription required/i.test(result.error)) return 'entitlement';
  return 'transient';
}

/** Only a transient failure is worth a retry button. */
export function canRetryCoach(kind: CoachFailureKind): boolean {
  return kind === 'transient';
}

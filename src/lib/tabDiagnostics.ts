import { markCrashMarker, recordCrashError } from '@/lib/crashDiagnostics';
import { captureMobileException } from '@/lib/sentry';

export type TabDiagnosticEvent =
  | 'WORKOUT_TAB_ENTER'
  | 'WORKOUT_TAB_SUCCESS'
  | 'WORKOUT_TAB_FAILURE'
  | 'NUTRITION_TAB_ENTER'
  | 'NUTRITION_TAB_SUCCESS'
  | 'NUTRITION_TAB_FAILURE'
  | 'RESET_STARTED'
  | 'RESET_COMPLETED'
  | 'RESET_FAILED'
  | 'ADD_EXERCISE_STARTED'
  | 'ADD_EXERCISE_SUCCESS'
  | 'ADD_EXERCISE_FAILED'
  | 'WORKOUT_SELECTION_STARTED'
  | 'WORKOUT_SELECTION_SUCCESS'
  | 'WORKOUT_SELECTION_FAILED'
  | 'EMAIL_GENERATED'
  | 'EMAIL_SENT'
  | 'EMAIL_FAILED'
  /** @deprecated Use EMAIL_GENERATED */
  | 'EMAIL_SEND_STARTED'
  /** @deprecated Use EMAIL_SENT */
  | 'EMAIL_SEND_SUCCESS'
  /** @deprecated Use EMAIL_SEND_FAILED */
  | 'EMAIL_SEND_FAILED';

type TabDiagnosticDetail = {
  screen?: string;
  hook?: string;
  api?: string;
  error?: string;
  userId?: string;
  email?: string;
  exercise?: string;
  plannedWorkoutId?: string;
};

const FAILURE_EVENTS = new Set<TabDiagnosticEvent>([
  'WORKOUT_TAB_FAILURE',
  'NUTRITION_TAB_FAILURE',
  'RESET_FAILED',
  'ADD_EXERCISE_FAILED',
  'WORKOUT_SELECTION_FAILED',
  'EMAIL_FAILED',
  'EMAIL_SEND_FAILED',
]);

export function logTabDiagnostic(event: TabDiagnosticEvent, detail?: TabDiagnosticDetail): void {
  const payload = { event, ...detail, ts: new Date().toISOString() };
  console.log(`[TabDiagnostic] ${event}`, payload);
  markCrashMarker(event, detail);
  if (FAILURE_EVENTS.has(event)) {
    recordCrashError(new Error(`${event}: ${detail?.error ?? 'unknown'}`), {
      source: detail?.screen ?? 'tab',
      fatal: false,
    });
    captureMobileException(new Error(`${event}: ${detail?.error ?? 'unknown'}`), {
      screen: detail?.screen,
      userId: detail?.userId,
    });
  }
}

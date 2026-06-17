import { INTERVAL_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
import type { UserPreferences } from '@/types';

export const TABATA_MODE_PREF_KEY = 'tabataModeEnabled';

export function isTabataModeEnabled(preferences?: UserPreferences | null): boolean {
  return preferences?.coachingPreferences?.[TABATA_MODE_PREF_KEY] === true;
}

export function tabataModeSummary(): string {
  const { workSeconds, restSeconds, rounds } = INTERVAL_MODE_DEFAULTS.tabata;
  return `${workSeconds}s work · ${restSeconds}s rest · ${rounds} rounds`;
}

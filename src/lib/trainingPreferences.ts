import { INTERVAL_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
import type { UserPreferences } from '@/types';

export const TABATA_MODE_PREF_KEY = 'tabataModeEnabled';

/** In-workout Tabata timer: work and rest can be adjusted within this range (seconds). */
export const TABATA_INTERVAL_BOUNDS = {
  minSeconds: 10,
  maxSeconds: 45,
  stepSeconds: 5,
} as const;

export function clampTabataIntervalSeconds(seconds: number): number {
  const { minSeconds, maxSeconds, stepSeconds } = TABATA_INTERVAL_BOUNDS;
  const stepped = Math.round(seconds / stepSeconds) * stepSeconds;
  return Math.min(maxSeconds, Math.max(minSeconds, stepped));
}

/**
 * The Tabata protocol a session should open on.
 *
 * Tabata is a session-wide protocol here rather than a per-exercise one, so the whole session runs
 * one work/rest/rounds config. A plan that prescribes its own — an imported PDF asking for 30 on /
 * 15 off for 8 rounds — should be what the session starts at, rather than this app's defaults
 * silently overriding the document. The lifter can still retune it in the timer overlay.
 */
export function tabataConfigFromPlan(
  plan: Array<{ intervalWorkSeconds?: number; intervalRestSeconds?: number; intervalRounds?: number }>,
  clampRounds: (rounds: number) => number,
): { workSeconds: number; restSeconds: number; rounds: number } {
  const prescribed = plan.find(
    (exercise) => exercise.intervalWorkSeconds || exercise.intervalRestSeconds || exercise.intervalRounds,
  );
  return {
    workSeconds: prescribed?.intervalWorkSeconds
      ? clampTabataIntervalSeconds(prescribed.intervalWorkSeconds)
      : INTERVAL_MODE_DEFAULTS.tabata.workSeconds,
    restSeconds: prescribed?.intervalRestSeconds
      ? clampTabataIntervalSeconds(prescribed.intervalRestSeconds)
      : INTERVAL_MODE_DEFAULTS.tabata.restSeconds,
    rounds: prescribed?.intervalRounds
      ? clampRounds(prescribed.intervalRounds)
      : INTERVAL_MODE_DEFAULTS.tabata.rounds,
  };
}

/** Get-ready countdown before the first work interval (seconds). */
export const TABATA_PREP_SECONDS_DEFAULT = 60;

/** Default rest between exercises in Tabata mode (seconds). */
export const TABATA_BETWEEN_EXERCISE_REST_DEFAULT = 60;

export const TABATA_BETWEEN_EXERCISE_REST_BOUNDS = {
  minSeconds: 30,
  maxSeconds: 300,
  stepSeconds: 15,
} as const;

export function clampTabataBetweenExerciseRest(seconds: number): number {
  const { minSeconds, maxSeconds, stepSeconds } = TABATA_BETWEEN_EXERCISE_REST_BOUNDS;
  const stepped = Math.round(seconds / stepSeconds) * stepSeconds;
  return Math.min(maxSeconds, Math.max(minSeconds, stepped));
}

export function isTabataModeEnabled(preferences?: UserPreferences | null): boolean {
  return preferences?.coachingPreferences?.[TABATA_MODE_PREF_KEY] === true;
}

export function tabataModeSummary(): string {
  const { workSeconds, restSeconds, rounds } = INTERVAL_MODE_DEFAULTS.tabata;
  return `${workSeconds}s work · ${restSeconds}s rest · ${rounds} rounds`;
}

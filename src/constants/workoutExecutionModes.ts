import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export type WorkoutExecutionModeDefinition = {
  id: WorkoutExecutionMode;
  label: string;
  description: string;
  scheme: 'set_rep' | 'interval' | 'circuit' | 'superset';
};

/**
 * Canonical definitions for all workout execution modes.
 */
export const WORKOUT_EXECUTION_MODE_DEFINITIONS: WorkoutExecutionModeDefinition[] = [
  {
    id: 'traditional',
    label: 'Traditional',
    description: 'Standard sets and reps with full rest between sets.',
    scheme: 'set_rep',
  },
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    description: 'Moderate load, higher volume, moderate rest for muscle growth.',
    scheme: 'set_rep',
  },
  {
    id: 'strength',
    label: 'Strength',
    description: 'Heavier load, lower reps, longer rest for maximal strength.',
    scheme: 'set_rep',
  },
  {
    id: 'hiit',
    label: 'HIIT',
    description: 'Timed work and rest intervals for high-intensity conditioning.',
    scheme: 'interval',
  },
  {
    id: 'tabata',
    label: 'Tabata',
    description: 'Short maximal-effort bursts with brief recovery.',
    scheme: 'interval',
  },
  {
    id: 'circuit',
    label: 'Circuit',
    description: 'Multiple rounds with minimal rest between stations.',
    scheme: 'circuit',
  },
  {
    id: 'superset',
    label: 'Superset',
    description: 'Paired exercises performed back-to-back before resting.',
    scheme: 'superset',
  },
];

export const SET_REP_MODE_DEFAULTS: Record<
  Extract<WorkoutExecutionMode, 'traditional' | 'hypertrophy' | 'strength'>,
  { sets: number; repRange: string; restSeconds: number }
> = {
  traditional: { sets: 3, repRange: '10', restSeconds: 90 },
  hypertrophy: { sets: 4, repRange: '8-12', restSeconds: 60 },
  strength: { sets: 5, repRange: '3-5', restSeconds: 180 },
};

export const INTERVAL_MODE_DEFAULTS: Record<
  Extract<WorkoutExecutionMode, 'hiit' | 'tabata'>,
  { workSeconds: number; restSeconds: number; rounds: number }
> = {
  hiit: { workSeconds: 45, restSeconds: 15, rounds: 8 },
  tabata: { workSeconds: 20, restSeconds: 10, rounds: 10 },
};

export const CIRCUIT_MODE_DEFAULTS = {
  rounds: 3,
  repRange: '12',
  restBetweenExercisesSeconds: 15,
  restBetweenRoundsSeconds: 60,
} as const;

export const SUPERSET_MODE_DEFAULTS = {
  sets: 3,
  repRange: '10-12',
  restBetweenExercisesSeconds: 0,
  restBetweenRoundSetsSeconds: 90,
} as const;

export function workoutExecutionModeDefinition(
  mode: WorkoutExecutionMode,
): WorkoutExecutionModeDefinition | undefined {
  return WORKOUT_EXECUTION_MODE_DEFINITIONS.find((definition) => definition.id === mode);
}

/**
 * Sprint 2 workout execution modes — backend mirror for tests and future API use.
 */

export type WorkoutExecutionMode =
  | 'traditional'
  | 'hypertrophy'
  | 'strength'
  | 'hiit'
  | 'tabata'
  | 'circuit'
  | 'superset';

export type ExercisePrescriptionInput = {
  name: string;
  mode: WorkoutExecutionMode;
  sets?: number;
  repRange?: string;
  restSeconds?: number;
};

export type ExerciseExecutionPrescription =
  | { scheme: 'set_rep'; mode: WorkoutExecutionMode; sets: number; repRange: string; restSeconds: number }
  | { scheme: 'interval'; mode: WorkoutExecutionMode; workSeconds: number; restSeconds: number; rounds: number }
  | {
      scheme: 'circuit';
      mode: 'circuit';
      rounds: number;
      repRange: string;
      restBetweenExercisesSeconds: number;
      restBetweenRoundsSeconds: number;
    }
  | {
      scheme: 'superset';
      mode: 'superset';
      sets: number;
      repRange: string;
      restBetweenExercisesSeconds: number;
      restBetweenRoundSetsSeconds: number;
    };

const SET_REP_DEFAULTS = {
  traditional: { sets: 3, repRange: '10', restSeconds: 90 },
  hypertrophy: { sets: 4, repRange: '8-12', restSeconds: 60 },
  strength: { sets: 5, repRange: '3-5', restSeconds: 180 },
} as const;

const INTERVAL_DEFAULTS = {
  hiit: { workSeconds: 45, restSeconds: 15, rounds: 8 },
  tabata: { workSeconds: 20, restSeconds: 20, rounds: 10 },
} as const;

export function prescribeExerciseExecution(input: ExercisePrescriptionInput): ExerciseExecutionPrescription {
  const { mode, sets, repRange, restSeconds } = input;

  if (mode === 'traditional' || mode === 'hypertrophy' || mode === 'strength') {
    const defaults = SET_REP_DEFAULTS[mode];
    return {
      scheme: 'set_rep',
      mode,
      sets: sets ?? defaults.sets,
      repRange: repRange ?? defaults.repRange,
      restSeconds: restSeconds ?? defaults.restSeconds,
    };
  }

  if (mode === 'hiit' || mode === 'tabata') {
    const defaults = INTERVAL_DEFAULTS[mode];
    return {
      scheme: 'interval',
      mode,
      workSeconds: defaults.workSeconds,
      restSeconds: defaults.restSeconds,
      rounds: defaults.rounds,
    };
  }

  if (mode === 'circuit') {
    return {
      scheme: 'circuit',
      mode: 'circuit',
      rounds: 3,
      repRange: repRange ?? '12',
      restBetweenExercisesSeconds: 15,
      restBetweenRoundsSeconds: 60,
    };
  }

  return {
    scheme: 'superset',
    mode: 'superset',
    sets: sets ?? 3,
    repRange: repRange ?? '10-12',
    restBetweenExercisesSeconds: 0,
    restBetweenRoundSetsSeconds: 90,
  };
}

export function formatExercisePrescriptionSummary(prescription: ExerciseExecutionPrescription): string {
  switch (prescription.scheme) {
    case 'set_rep':
      return `${prescription.sets} x ${prescription.repRange}`;
    case 'interval':
      return `${prescription.workSeconds} sec work · ${prescription.restSeconds} sec rest · ${prescription.rounds} rounds`;
    case 'circuit':
      return `${prescription.rounds} rounds · ${prescription.repRange} reps`;
    case 'superset':
      return `${prescription.sets} x ${prescription.repRange}`;
    default:
      return '';
  }
}

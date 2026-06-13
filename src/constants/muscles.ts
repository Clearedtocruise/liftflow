import type { Slug } from 'react-native-body-highlighter';

/** Typed muscle ids used across exercise → anatomy resolution. */
export type MuscleId =
  | 'chest'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'mid-back'
  | 'upper-back'
  | 'traps'
  | 'lower-back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'obliques'
  | 'core'
  | 'neck'
  | 'hip-flexors'
  | 'adductors'
  | 'abductors'
  | 'full-body';

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  'front-delts': 'Front Delts',
  'side-delts': 'Side Delts',
  'rear-delts': 'Rear Delts',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  'mid-back': 'Mid Back',
  'upper-back': 'Upper Back',
  traps: 'Traps',
  'lower-back': 'Lower Back',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  obliques: 'Obliques',
  core: 'Core',
  neck: 'Neck',
  'hip-flexors': 'Hip Flexors',
  adductors: 'Adductors',
  abductors: 'Abductors',
  'full-body': 'Full Body',
};

/** Maps each MuscleId to body-highlighter slug(s). */
export const MUSCLE_SLUGS: Record<MuscleId, Slug[]> = {
  chest: ['chest'],
  'front-delts': ['deltoids'],
  'side-delts': ['deltoids'],
  'rear-delts': ['deltoids'],
  shoulders: ['deltoids'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  forearms: ['forearm'],
  lats: ['upper-back'],
  'mid-back': ['upper-back'],
  'upper-back': ['upper-back'],
  traps: ['trapezius'],
  'lower-back': ['lower-back'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  abs: ['abs'],
  obliques: ['obliques'],
  core: ['abs'],
  neck: ['neck'],
  'hip-flexors': ['adductors'],
  adductors: ['adductors'],
  abductors: ['gluteal'],
  'full-body': ['chest', 'abs', 'deltoids', 'quadriceps', 'calves', 'upper-back'],
};

export function muscleLabel(id: MuscleId): string {
  return MUSCLE_LABELS[id] ?? id;
}

export function muscleLabels(ids: MuscleId[]): string {
  return ids.map(muscleLabel).join(' · ');
}

const BACK_BIAS = new Set<MuscleId>([
  'lats',
  'mid-back',
  'upper-back',
  'traps',
  'lower-back',
  'hamstrings',
  'glutes',
  'triceps',
  'rear-delts',
  'calves',
  'abductors',
]);

export function defaultBodySide(primary: MuscleId[], secondary: MuscleId[]): 'front' | 'back' {
  const all = [...primary, ...secondary];
  let back = 0;
  let front = 0;
  for (const muscle of all) {
    const weight = primary.includes(muscle) ? 2 : 1;
    if (BACK_BIAS.has(muscle)) back += weight;
    else front += weight;
  }
  return back > front ? 'back' : 'front';
}

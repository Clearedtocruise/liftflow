import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { getExerciseLoggingMode, isTimedExercise } from '@/lib/exerciseModality';
import type { Exercise } from '@/types';
import type { LoadingMethod, LoadingMethodOption } from '@/types/exerciseLoading';

const DEFAULT_LOADING_METHODS: Record<string, LoadingMethod[]> = {
  'pull-up': ['bodyweight', 'bodyweight_plus_weight'],
  'push-up': ['bodyweight', 'bodyweight_plus_weight'],
  'chin-up': ['bodyweight', 'bodyweight_plus_weight'],
  dip: ['bodyweight', 'bodyweight_plus_weight'],
  'walking-lunge': ['bodyweight', 'external_load'],
  'dumbbell-lunge': ['external_load'],
  plank: ['timed_hold'],
  'side-plank': ['timed_hold'],
};

const LOADING_LABELS: Record<LoadingMethod, string> = {
  bodyweight: 'Bodyweight',
  bodyweight_plus_weight: 'Added weight',
  external_load: 'External load',
  timed_hold: 'Timed hold',
  distance: 'Distance',
};

export function supportedLoadingMethods(
  exercise: Exercise | null | undefined,
  slug?: string | null,
): LoadingMethod[] {
  const key = slug ?? exercise?.slug;
  if (key) {
    const catalog = catalogExerciseBySlug(key);
    const fromCatalog = (catalog as { loadingMethods?: LoadingMethod[] } | undefined)?.loadingMethods;
    if (fromCatalog?.length) return fromCatalog;
    if (DEFAULT_LOADING_METHODS[key]) return DEFAULT_LOADING_METHODS[key]!;
  }

  if (isTimedExercise(exercise, undefined, exercise?.name)) {
    const label = (exercise?.name ?? '').toLowerCase();
    if (label.includes('farmer') || label.includes('yoke') || label.includes('suitcase')) {
      return ['external_load', 'timed_hold'];
    }
    return ['timed_hold'];
  }

  const label = (exercise?.name ?? '').toLowerCase();
  if (
    exercise?.exerciseType === 'cardio' &&
    (label.includes('thruster') || label.includes('dumbbell') || label.includes('db '))
  ) {
    return ['external_load', 'distance'];
  }

  const mode = getExerciseLoggingMode(exercise);
  if (mode === 'cardio') return ['distance'];
  if (mode === 'bodyweight') return ['bodyweight', 'bodyweight_plus_weight'];
  if (mode === 'timed') return ['timed_hold'];
  return ['external_load'];
}

export function loadingMethodOptions(
  exercise: Exercise | null | undefined,
  slug?: string | null,
): LoadingMethodOption[] {
  return supportedLoadingMethods(exercise, slug).map((method) => ({
    method,
    label: LOADING_LABELS[method],
  }));
}

/** Immediate default when switching exercises — before async history loads. */
export function defaultLoadingMethodForExercise(
  exercise: Exercise | null | undefined,
  slug?: string | null,
): LoadingMethod {
  const supported = supportedLoadingMethods(exercise, slug);
  if (supported.length === 1) return supported[0]!;

  const mode = getExerciseLoggingMode(exercise, undefined, exercise?.name);
  // Prefer bodyweight first-time for dual BW/added-weight movements; history overrides later.
  if (mode === 'bodyweight' && supported.includes('bodyweight')) return 'bodyweight';
  if (mode === 'timed' && supported.includes('timed_hold')) return 'timed_hold';
  if (mode === 'cardio' && supported.includes('distance')) return 'distance';
  if (supported.includes('external_load')) return 'external_load';
  if (supported.includes('bodyweight')) return 'bodyweight';
  return supported[0] ?? 'external_load';
}

export function inferLoadingMethodFromHistory(
  exercise: Exercise | null | undefined,
  slug: string | undefined,
  lastWeightKg?: number | null,
  lastDurationSeconds?: number | null,
): LoadingMethod {
  const supported = supportedLoadingMethods(exercise, slug);
  const label = (exercise?.name ?? '').toLowerCase();

  if (supported.includes('external_load') && label.includes('farmer')) {
    return 'external_load';
  }
  if (
    supported.includes('external_load') &&
    exercise?.exerciseType === 'cardio' &&
    (label.includes('thruster') || label.includes('dumbbell'))
  ) {
    return 'external_load';
  }
  if (lastDurationSeconds != null && lastDurationSeconds > 0 && supported.includes('timed_hold')) {
    return 'timed_hold';
  }
  // Prior weighted set wins — belt/vest work should reopen as added weight.
  if (lastWeightKg != null && lastWeightKg > 0) {
    if (supported.includes('bodyweight_plus_weight')) return 'bodyweight_plus_weight';
    if (supported.includes('external_load')) return 'external_load';
  }
  if (supported.includes('timed_hold') && !label.includes('farmer')) {
    return 'timed_hold';
  }
  if (supported.includes('distance')) return 'distance';
  if (supported.includes('bodyweight')) return 'bodyweight';
  if (supported.includes('external_load') && exercise?.exerciseType === 'strength') {
    return 'external_load';
  }
  return supported[0] ?? 'external_load';
}

export function loadingMethodToLoggingMode(method: LoadingMethod): ExerciseLoggingMode {
  switch (method) {
    case 'timed_hold':
      return 'timed';
    case 'distance':
      return 'cardio';
    case 'bodyweight':
      return 'bodyweight';
    case 'bodyweight_plus_weight':
    case 'external_load':
    default:
      return 'weighted';
  }
}

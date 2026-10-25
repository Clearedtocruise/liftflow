import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import { isFlatBodyweightPulldownName } from '@/lib/exerciseClassification';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { getExerciseLoggingMode, isTimedExercise } from '@/lib/exerciseModality';
import type { Exercise } from '@/types';
import type { LoadingMethod, LoadingMethodOption } from '@/types/exerciseLoading';

const DEFAULT_LOADING_METHODS: Record<string, LoadingMethod[]> = {
  'pull-up': ['bodyweight', 'bodyweight_plus_weight'],
  'push-up': ['bodyweight', 'bodyweight_plus_weight'],
  'chin-up': ['bodyweight', 'bodyweight_plus_weight'],
  dip: ['bodyweight', 'bodyweight_plus_weight'],
  'hanging-leg-raise': ['bodyweight', 'bodyweight_plus_weight'],
  'hanging-knee-raise': ['bodyweight', 'bodyweight_plus_weight'],
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

/**
 * Any loaded lift can be done with nothing in hand: no dumbbells at the hotel, a light day, a
 * movement drill. Offer reps-only on every lift that takes a load.
 */
function withBodyweightOption(methods: LoadingMethod[]): LoadingMethod[] {
  if (!methods.includes('external_load') || methods.includes('bodyweight')) return methods;
  return [...methods, 'bodyweight'];
}

export function supportedLoadingMethods(
  exercise: Exercise | null | undefined,
  slug?: string | null,
): LoadingMethod[] {
  return withBodyweightOption(supportedLoadingMethodsForLift(exercise, slug));
}

function supportedLoadingMethodsForLift(
  exercise: Exercise | null | undefined,
  slug?: string | null,
): LoadingMethod[] {
  const label = `${exercise?.name ?? ''} ${slug ?? ''}`.toLowerCase();
  // Reps only. A previous 5 lb log must not flip this back to a weight stepper.
  if (isFlatBodyweightPulldownName(label)) return ['bodyweight'];

  const key = slug ?? exercise?.slug;
  if (key) {
    const catalog = catalogExerciseBySlug(key);
    const fromCatalog = (catalog as { loadingMethods?: LoadingMethod[] } | undefined)?.loadingMethods;
    if (fromCatalog?.length) return fromCatalog;
    if (DEFAULT_LOADING_METHODS[key]) return DEFAULT_LOADING_METHODS[key]!;
  }

  // Catalog slug can be missing on a custom/imported row; still offer added weight for these.
  if (/\bhanging\s+(leg|knee)\s+raises?\b/.test(label) || /\bhanging-leg-raise\b/.test(label)) {
    return ['bodyweight', 'bodyweight_plus_weight'];
  }

  if (isTimedExercise(exercise, undefined, exercise?.name)) {
    return ['timed_hold'];
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

export function inferLoadingMethodFromHistory(
  exercise: Exercise | null | undefined,
  slug: string | undefined,
  lastWeightKg?: number | null,
  lastDurationSeconds?: number | null,
  lastReps?: number | null,
): LoadingMethod {
  const supported = supportedLoadingMethods(exercise, slug);
  if (supported.includes('timed_hold')) return 'timed_hold';
  if (supported.includes('distance')) return 'distance';
  if (lastDurationSeconds != null && lastDurationSeconds > 0 && supported.includes('timed_hold')) {
    return 'timed_hold';
  }
  if (lastWeightKg != null && lastWeightKg > 0) {
    if (supported.includes('bodyweight_plus_weight')) return 'bodyweight_plus_weight';
    if (supported.includes('external_load')) return 'external_load';
  }
  // A loaded lift last logged as reps with no weight was switched to bodyweight; keep it there.
  if (lastReps != null && lastReps > 0 && supported.includes('bodyweight')) return 'bodyweight';
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

import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

import { catalogExerciseBySlug, SYSTEM_EXERCISE_CATALOG } from '@/constants/exerciseDatabase';
import {
    defaultBodySide,
    filterMusclesForSide,
    MUSCLE_SLUGS,
    type MuscleId,
} from '@/constants/muscles';

export const MUSCLE_HIGHLIGHT_PRIMARY = '#FF4D5A';
export const MUSCLE_HIGHLIGHT_SECONDARY = '#0E90FF';

export type ExerciseMuscleProfile = {
  primary: MuscleId[];
  secondary: MuscleId[];
};

const MUSCLE_ALIASES: Record<string, MuscleId> = {
  chest: 'chest',
  pecs: 'chest',
  pectorals: 'chest',
  shoulders: 'shoulders',
  delts: 'shoulders',
  deltoids: 'shoulders',
  'front delts': 'front-delts',
  'side delts': 'side-delts',
  'rear delts': 'rear-delts',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'forearms',
  back: 'mid-back',
  lats: 'lats',
  'mid back': 'mid-back',
  'upper back': 'upper-back',
  traps: 'traps',
  trapezius: 'traps',
  'lower back': 'lower-back',
  quads: 'quads',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
  obliques: 'obliques',
  core: 'core',
  legs: 'quads',
  'full body': 'full-body',
  full_body: 'full-body',
  neck: 'neck',
  'hip flexors': 'hip-flexors',
  adductors: 'adductors',
  abductors: 'abductors',
};

/** Per-exercise primary / secondary muscles for the system catalog. */
export const EXERCISE_MUSCLE_PROFILES: Record<string, ExerciseMuscleProfile> = {
  'bench-press': { primary: ['chest'], secondary: ['triceps', 'front-delts'] },
  'incline-bench-press': { primary: ['chest', 'front-delts'], secondary: ['triceps'] },
  'dumbbell-bench-press': { primary: ['chest'], secondary: ['triceps', 'front-delts'] },
  'band-chest-press': { primary: ['chest'], secondary: ['triceps', 'front-delts'] },
  'cable-fly': { primary: ['chest'], secondary: ['front-delts'] },
  'push-up': { primary: ['chest'], secondary: ['triceps', 'front-delts', 'core'] },
  'overhead-press': { primary: ['front-delts', 'side-delts'], secondary: ['triceps', 'traps', 'core'] },
  'dumbbell-shoulder-press': { primary: ['front-delts', 'side-delts'], secondary: ['triceps'] },
  'tricep-pushdown': { primary: ['triceps'], secondary: ['forearms'] },
  'pull-up': { primary: ['lats'], secondary: ['biceps', 'mid-back', 'rear-delts'] },
  'lat-pulldown': { primary: ['lats'], secondary: ['biceps', 'mid-back', 'rear-delts'] },
  'barbell-row': { primary: ['mid-back', 'lats'], secondary: ['rear-delts', 'biceps', 'lower-back'] },
  'dumbbell-row': { primary: ['lats', 'mid-back'], secondary: ['biceps', 'rear-delts'] },
  'band-row': { primary: ['mid-back', 'lats'], secondary: ['biceps', 'rear-delts'] },
  'seated-cable-row': { primary: ['mid-back', 'lats'], secondary: ['biceps', 'rear-delts'] },
  'band-pull-apart': { primary: ['rear-delts'], secondary: ['traps', 'mid-back'] },
  'dumbbell-curl': { primary: ['biceps'], secondary: ['forearms'] },
  'squat': { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core', 'lower-back'] },
  'front-squat': { primary: ['quads'], secondary: ['glutes', 'core', 'upper-back'] },
  'goblet-squat': { primary: ['quads', 'glutes'], secondary: ['core'] },
  'hack-squat': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'leg-press': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'bodyweight-squat': { primary: ['quads', 'glutes'], secondary: ['core'] },
  'dumbbell-lunge': { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  'walking-lunge': { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  deadlift: { primary: ['glutes', 'hamstrings', 'lower-back'], secondary: ['lats', 'traps', 'forearms', 'quads'] },
  'romanian-deadlift': { primary: ['hamstrings', 'glutes'], secondary: ['lower-back', 'forearms'] },
  'dumbbell-rdl': { primary: ['hamstrings', 'glutes'], secondary: ['lower-back'] },
  'leg-curl': { primary: ['hamstrings'], secondary: ['calves'] },
  'calf-raise': { primary: ['calves'], secondary: [] },
  plank: { primary: ['abs', 'core'], secondary: ['obliques', 'lower-back'] },
  'side-plank': { primary: ['obliques', 'core'], secondary: ['abs'] },
  running: { primary: ['quads', 'calves'], secondary: ['glutes', 'hamstrings'] },
  swimming: { primary: ['lats', 'shoulders'], secondary: ['triceps', 'core'] },
  cycling: { primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings'] },
  rowing: { primary: ['lats', 'mid-back'], secondary: ['biceps', 'quads', 'core'] },
  'recovery-walk': { primary: ['calves'], secondary: ['quads'] },
};

export function normalizeExerciseSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function aliasToMuscle(raw: string): MuscleId | undefined {
  const key = raw.trim().toLowerCase();
  return MUSCLE_ALIASES[key];
}

function deriveFromMuscleGroups(groups: string[]): ExerciseMuscleProfile {
  const mapped = groups
    .map(aliasToMuscle)
    .filter((muscle): muscle is MuscleId => muscle != null && muscle !== 'full-body');

  if (mapped.length === 0) {
    return { primary: ['full-body'], secondary: [] };
  }

  return {
    primary: [mapped[0]],
    secondary: mapped.slice(1),
  };
}

function deriveFromNamePattern(name: string): ExerciseMuscleProfile {
  const lower = name.toLowerCase();
  if (/\b(bench|fly|push-up|pushup|dip)\b/.test(lower)) {
    return { primary: ['chest'], secondary: ['triceps', 'front-delts'] };
  }
  if (/\b(pull-up|pullup|pulldown|chin-up|row)\b/.test(lower)) {
    return { primary: ['lats'], secondary: ['biceps', 'mid-back'] };
  }
  if (/\b(squat|lunge|leg press)\b/.test(lower)) {
    return { primary: ['quads', 'glutes'], secondary: ['hamstrings'] };
  }
  if (/\b(deadlift|rdl|hinge)\b/.test(lower)) {
    return { primary: ['hamstrings', 'glutes'], secondary: ['lower-back'] };
  }
  if (/\b(curl)\b/.test(lower)) {
    return { primary: ['biceps'], secondary: ['forearms'] };
  }
  if (/\b(press|ohp|shoulder)\b/.test(lower)) {
    return { primary: ['shoulders'], secondary: ['triceps'] };
  }
  if (/\b(plank|core|crunch)\b/.test(lower)) {
    return { primary: ['core'], secondary: ['abs'] };
  }
  if (/\b(weighted\s+sit[\s-]?up|sit[\s-]?up|windshield\s*wiper|russian\s+twist|dead\s+bug|hanging\s+leg\s+raise|leg\s+raise|toes?\s+to\s+bar|v[\s-]?up|hollow\s+rock)\b/.test(lower)) {
    return { primary: ['core'], secondary: ['obliques', 'abs'] };
  }
  if (/\b(calf)\b/.test(lower)) {
    return { primary: ['calves'], secondary: [] };
  }
  if (/\b(run|walk|cardio|bike|cycle|swim|rower)\b/.test(lower)) {
    return { primary: ['quads'], secondary: ['calves', 'glutes'] };
  }
  return { primary: ['full-body'], secondary: [] };
}

export function resolveExerciseMuscles(
  exerciseName: string,
  muscleGroups?: string[],
): ExerciseMuscleProfile {
  const slug = normalizeExerciseSlug(exerciseName);
  const authored = EXERCISE_MUSCLE_PROFILES[slug];
  if (authored) return authored;

  const catalog = catalogExerciseBySlug(slug);
  if (catalog && EXERCISE_MUSCLE_PROFILES[catalog.slug]) {
    return EXERCISE_MUSCLE_PROFILES[catalog.slug];
  }

  const byName = SYSTEM_EXERCISE_CATALOG.find(
    (item) => item.name.toLowerCase() === exerciseName.trim().toLowerCase(),
  );
  if (byName && EXERCISE_MUSCLE_PROFILES[byName.slug]) {
    return EXERCISE_MUSCLE_PROFILES[byName.slug];
  }

  const groups = muscleGroups ?? catalog?.muscleGroups ?? byName?.muscleGroups;
  if (groups?.length) {
    const filtered = groups.filter((g) => g !== 'cardiovascular');
    if (filtered.length > 0) return deriveFromMuscleGroups(filtered);
  }

  return deriveFromNamePattern(exerciseName);
}

export function buildBodyHighlightData(
  primary: MuscleId[],
  secondary: MuscleId[],
  side?: 'front' | 'back',
): ExtendedBodyPart[] {
  const scopedPrimary = side ? filterMusclesForSide(primary, side) : primary;
  const scopedSecondary = side ? filterMusclesForSide(secondary, side) : secondary;
  const data: ExtendedBodyPart[] = [];
  const seen = new Set<string>();

  for (const muscleId of scopedPrimary) {
    for (const slug of muscleSlugsForId(muscleId)) {
      const key = `${slug}:2`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ slug, intensity: 2 });
    }
  }

  for (const muscleId of scopedSecondary) {
    for (const slug of muscleSlugsForId(muscleId)) {
      const key = `${slug}:1`;
      if (seen.has(`${slug}:2`) || seen.has(key)) continue;
      seen.add(key);
      data.push({ slug, intensity: 1 });
    }
  }

  return data;
}

export function filterProfileForSide(
  profile: ExerciseMuscleProfile,
  side: 'front' | 'back',
): ExerciseMuscleProfile {
  return {
    primary: filterMusclesForSide(profile.primary, side),
    secondary: filterMusclesForSide(profile.secondary, side).filter(
      (muscle) => !profile.primary.includes(muscle),
    ),
  };
}

function muscleSlugsForId(muscleId: MuscleId): Slug[] {
  return MUSCLE_SLUGS[muscleId] ?? [];
}

export function resolveBodySide(profile: ExerciseMuscleProfile): 'front' | 'back' {
  return defaultBodySide(profile.primary, profile.secondary);
}

export function profileFigureGender(sex?: string | null): 'male' | 'female' {
  return sex === 'female' ? 'female' : 'male';
}

export function aggregateWorkoutMuscles(exerciseNames: string[]): ExerciseMuscleProfile {
  const primaryCounts = new Map<MuscleId, number>();
  const secondaryCounts = new Map<MuscleId, number>();

  for (const name of exerciseNames) {
    const profile = resolveExerciseMuscles(name);
    for (const muscle of profile.primary) {
      primaryCounts.set(muscle, (primaryCounts.get(muscle) ?? 0) + 2);
    }
    for (const muscle of profile.secondary) {
      if (!profile.primary.includes(muscle)) {
        secondaryCounts.set(muscle, (secondaryCounts.get(muscle) ?? 0) + 1);
      }
    }
  }

  const primary = [...primaryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([muscle]) => muscle);

  const primarySet = new Set(primary);
  const secondary = [...secondaryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([muscle]) => muscle)
    .filter((muscle) => !primarySet.has(muscle))
    .slice(0, 2);

  if (primary.length === 0 && secondary.length === 0) {
    return { primary: ['full-body'], secondary: [] };
  }

  return { primary, secondary };
}

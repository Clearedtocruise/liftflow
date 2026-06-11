import { getExerciseCard, getExerciseCardByName, titleizeSlug } from '@/constants/exerciseDatabase';
import type { MuscleId } from '@/constants/muscles';
import { mapExercise } from '@/lib/db-mappers';
import { supabase } from '@/supabase/client';
import type { MovementCategory } from '@/types/common';
import type { BodyArea, ExerciseCardData, ExerciseMetric, MovementArchetype } from '@/types/exerciseCard';
import type { Exercise } from '@/types/workout';

/** Map free-form muscle strings (from Supabase) onto the typed taxonomy. */
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
  lats: 'lats',
  back: 'mid-back',
  'mid back': 'mid-back',
  'upper back': 'upper-back',
  traps: 'traps',
  'lower back': 'lower-back',
  spine: 'lower-back',
  quads: 'quads',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
  core: 'core',
  obliques: 'obliques',
  neck: 'neck',
  'hip flexors': 'hip-flexors',
  adductors: 'adductors',
  abductors: 'abductors',
  general: 'full-body',
  'full body': 'full-body',
};

function toMuscleId(raw: string): MuscleId | null {
  const key = raw.trim().toLowerCase();
  return MUSCLE_ALIASES[key] ?? null;
}

function toMuscleIds(values: string[] = []): MuscleId[] {
  const ids: MuscleId[] = [];
  for (const value of values) {
    const id = toMuscleId(value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const CATEGORY_ARCHETYPE: Record<MovementCategory, MovementArchetype> = {
  push: 'horizontal-press',
  pull: 'horizontal-pull',
  squat: 'squat',
  hinge: 'hinge',
  carry: 'carry',
  cardio: 'cardio',
  core: 'core-flexion',
  other: 'static',
};

const PRIMARY_BODY_AREA: Partial<Record<MuscleId, BodyArea>> = {
  chest: 'Chest',
  'front-delts': 'Shoulders',
  'side-delts': 'Shoulders',
  'rear-delts': 'Rear Delts',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  'mid-back': 'Mid Back',
  'upper-back': 'Upper Back',
  traps: 'Traps',
  'lower-back': 'Mid Back',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Core',
  core: 'Core',
  obliques: 'Core',
  'full-body': 'Full Body',
};

function metricForCategory(category: MovementCategory): ExerciseMetric {
  if (category === 'cardio') return 'time';
  return 'reps_weight';
}

/**
 * Build a coherent (if generic) card for an exercise that isn't hand-authored
 * yet. This guarantees every one of the 138+ catalog exercises renders the full
 * card layout. Authored content always takes precedence.
 */
export function deriveCardFromExercise(exercise: Exercise): ExerciseCardData {
  const authored =
    (exercise.slug ? getExerciseCard(exercise.slug) : undefined) ?? getExerciseCardByName(exercise.name);
  if (authored) return authored;

  const primaryMuscles = toMuscleIds(exercise.muscleGroups);
  const secondaryMuscles = toMuscleIds(exercise.secondaryMuscles);
  const firstPrimary = primaryMuscles[0];

  return {
    slug: exercise.slug ?? exercise.id,
    name: exercise.name,
    category: exercise.category,
    bodyArea: (firstPrimary && PRIMARY_BODY_AREA[firstPrimary]) ?? 'Full Body',
    equipment: exercise.equipment,
    difficulty: 'Intermediate',
    primaryMuscles: primaryMuscles.length ? primaryMuscles : ['full-body'],
    secondaryMuscles,
    archetype: CATEGORY_ARCHETYPE[exercise.category],
    coachingCues: [],
    commonMistakes: [],
    feel: {
      primary: primaryMuscles.length ? primaryMuscles : ['full-body'],
      secondary: secondaryMuscles,
    },
    alternatives: [],
    replacements: [],
    requiresEquipment: exercise.equipment ? [exercise.equipment.toLowerCase()] : [],
    metric: metricForCategory(exercise.category),
    authored: false,
  };
}

/**
 * Resolve the best card for a given identifier. Prefers authored content, then
 * derives from the provided Supabase exercise, then falls back to a name-only
 * card so navigation never dead-ends.
 */
export function resolveExerciseCard(opts: {
  slug?: string;
  name?: string;
  exercise?: Exercise;
}): ExerciseCardData | null {
  const { slug, name, exercise } = opts;
  if (slug) {
    const card = getExerciseCard(slug);
    if (card) return card;
  }
  if (name) {
    const card = getExerciseCardByName(name);
    if (card) return card;
  }
  if (exercise) return deriveCardFromExercise(exercise);
  return null;
}

function nameOnlyCard(opts: { slug?: string; name?: string }): ExerciseCardData {
  const name = opts.name ?? (opts.slug ? titleizeSlug(opts.slug) : 'Exercise');
  return {
    slug: opts.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    category: 'other',
    bodyArea: 'Full Body',
    equipment: 'Bodyweight',
    difficulty: 'Intermediate',
    primaryMuscles: ['full-body'],
    secondaryMuscles: [],
    archetype: 'static',
    coachingCues: [],
    commonMistakes: [],
    feel: { primary: ['full-body'], secondary: [] },
    alternatives: [],
    replacements: [],
    requiresEquipment: [],
    metric: 'reps_weight',
    authored: false,
  };
}

/**
 * Resolve a card for any identifier, falling back to Supabase for the catalog
 * exercises that aren't hand-authored yet. Always resolves to a renderable card
 * so the screen never shows a blank state.
 */
export async function fetchExerciseCard(opts: {
  slug?: string;
  name?: string;
  id?: string;
}): Promise<ExerciseCardData> {
  const authored = resolveExerciseCard({ slug: opts.slug, name: opts.name });
  if (authored) return authored;

  try {
    let query = supabase.from('exercises').select('*').limit(1);
    if (opts.id) query = query.eq('id', opts.id);
    else if (opts.slug) query = query.eq('slug', opts.slug);
    else if (opts.name) query = query.ilike('name', opts.name);

    const { data } = await query.maybeSingle();
    if (data) return deriveCardFromExercise(mapExercise(data));
  } catch {
    // fall through to name-only card
  }

  return nameOnlyCard(opts);
}

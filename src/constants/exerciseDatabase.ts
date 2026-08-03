import type { MovementCategory } from '@/types/common';
import type { ExerciseType } from '@/types/exerciseClassification';
import type { LoadingMethod } from '@/types/exerciseLoading';

export type CatalogExercise = {
  slug: string;
  name: string;
  movementCategory: MovementCategory;
  equipment: string;
  muscleGroups: string[];
  exerciseType: ExerciseType;
  loadingMethods?: LoadingMethod[];
  metadata?: {
    requires?: string[];
    movement_family?: string;
  };
};

/**
 * Canonical system exercise catalog with Sprint 1 classification.
 * Slugs must stay in sync with supabase seed migrations.
 */
export const SYSTEM_EXERCISE_CATALOG: CatalogExercise[] = [
  // Strength — barbell / machine / loaded
  { slug: 'bench-press', name: 'Bench Press', movementCategory: 'push', equipment: 'barbell', muscleGroups: ['chest', 'triceps', 'shoulders'], exerciseType: 'strength', metadata: { requires: ['barbell', 'bench', 'rack'], movement_family: 'horizontal_press' } },
  { slug: 'incline-bench-press', name: 'Incline Bench Press', movementCategory: 'push', equipment: 'barbell', muscleGroups: ['chest', 'shoulders'], exerciseType: 'strength', metadata: { requires: ['barbell', 'bench', 'rack'], movement_family: 'horizontal_press' } },
  { slug: 'overhead-press', name: 'Overhead Press', movementCategory: 'push', equipment: 'barbell', muscleGroups: ['shoulders', 'triceps'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'vertical_press' } },
  { slug: 'squat', name: 'Squat', movementCategory: 'squat', equipment: 'barbell', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'squat_pattern' } },
  { slug: 'front-squat', name: 'Front Squat', movementCategory: 'squat', equipment: 'barbell', muscleGroups: ['quads', 'core'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'squat_pattern' } },
  { slug: 'deadlift', name: 'Deadlift', movementCategory: 'hinge', equipment: 'barbell', muscleGroups: ['back', 'hamstrings', 'glutes'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'hinge_pattern' } },
  { slug: 'romanian-deadlift', name: 'Romanian Deadlift', movementCategory: 'hinge', equipment: 'barbell', muscleGroups: ['hamstrings', 'glutes'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'hinge_pattern' } },
  { slug: 'barbell-row', name: 'Barbell Row', movementCategory: 'pull', equipment: 'barbell', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'horizontal_pull' } },
  { slug: 'lat-pulldown', name: 'Lat Pulldown', movementCategory: 'pull', equipment: 'cable', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'vertical_pull' } },
  { slug: 'dumbbell-curl', name: 'Dumbbell Curl', movementCategory: 'pull', equipment: 'dumbbell', muscleGroups: ['biceps'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'biceps' } },
  { slug: 'tricep-pushdown', name: 'Tricep Pushdown', movementCategory: 'push', equipment: 'cable', muscleGroups: ['triceps'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'triceps' } },
  { slug: 'leg-press', name: 'Leg Press', movementCategory: 'squat', equipment: 'machine', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'squat_pattern' } },
  { slug: 'leg-curl', name: 'Leg Curl', movementCategory: 'hinge', equipment: 'machine', muscleGroups: ['hamstrings'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'hamstrings' } },
  { slug: 'calf-raise', name: 'Calf Raise', movementCategory: 'other', equipment: 'machine', muscleGroups: ['calves'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'calves' } },
  { slug: 'band-chest-press', name: 'Band Chest Press', movementCategory: 'push', equipment: 'bands', muscleGroups: ['chest', 'triceps'], exerciseType: 'strength', metadata: { requires: ['bands'], movement_family: 'horizontal_press' } },
  { slug: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', movementCategory: 'push', equipment: 'dumbbell', muscleGroups: ['chest', 'triceps', 'shoulders'], exerciseType: 'strength', metadata: { requires: ['dumbbells', 'bench'], movement_family: 'horizontal_press' } },
  { slug: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', movementCategory: 'push', equipment: 'dumbbell', muscleGroups: ['shoulders', 'triceps'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'vertical_press' } },
  { slug: 'dumbbell-row', name: 'Dumbbell Row', movementCategory: 'pull', equipment: 'dumbbell', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', metadata: { requires: ['dumbbells', 'bench'], movement_family: 'horizontal_pull' } },
  { slug: 'band-row', name: 'Band Row', movementCategory: 'pull', equipment: 'bands', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', metadata: { requires: ['bands'], movement_family: 'horizontal_pull' } },
  { slug: 'goblet-squat', name: 'Goblet Squat', movementCategory: 'squat', equipment: 'dumbbell', muscleGroups: ['quads', 'glutes', 'core'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'squat_pattern' } },
  { slug: 'dumbbell-rdl', name: 'Dumbbell Romanian Deadlift', movementCategory: 'hinge', equipment: 'dumbbell', muscleGroups: ['hamstrings', 'glutes'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'hinge_pattern' } },
  { slug: 'band-pull-apart', name: 'Band Pull-Apart', movementCategory: 'pull', equipment: 'bands', muscleGroups: ['shoulders', 'back'], exerciseType: 'strength', metadata: { requires: ['bands'], movement_family: 'rear_delt' } },
  { slug: 'dumbbell-lunge', name: 'Dumbbell Lunge', movementCategory: 'squat', equipment: 'dumbbell', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'lunge_pattern' } },
  { slug: 'cable-fly', name: 'Cable Fly', movementCategory: 'push', equipment: 'cable', muscleGroups: ['chest'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'horizontal_press' } },
  { slug: 'seated-cable-row', name: 'Seated Cable Row', movementCategory: 'pull', equipment: 'cable', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'horizontal_pull' } },
  { slug: 'hack-squat', name: 'Hack Squat', movementCategory: 'squat', equipment: 'machine', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'squat_pattern' } },

  // Bodyweight — no external load
  { slug: 'pull-up', name: 'Pull Up', movementCategory: 'pull', equipment: 'bodyweight', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'bodyweight_plus_weight'], metadata: { requires: ['pull_up_bar'], movement_family: 'vertical_pull' } },
  { slug: 'chin-up', name: 'Chin Up', movementCategory: 'pull', equipment: 'bodyweight', muscleGroups: ['back', 'biceps'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'bodyweight_plus_weight'], metadata: { requires: ['pull_up_bar'], movement_family: 'vertical_pull' } },
  { slug: 'dip', name: 'Dip', movementCategory: 'push', equipment: 'bodyweight', muscleGroups: ['chest', 'triceps'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'bodyweight_plus_weight'], metadata: { requires: ['bodyweight'], movement_family: 'triceps' } },
  { slug: 'push-up', name: 'Push-Up', movementCategory: 'push', equipment: 'bodyweight', muscleGroups: ['chest', 'triceps', 'shoulders'], exerciseType: 'bodyweight', loadingMethods: ['bodyweight', 'bodyweight_plus_weight'], metadata: { requires: ['bodyweight'], movement_family: 'horizontal_press' } },
  { slug: 'bodyweight-squat', name: 'Bodyweight Squat', movementCategory: 'squat', equipment: 'bodyweight', muscleGroups: ['quads', 'glutes'], exerciseType: 'bodyweight', metadata: { requires: ['bodyweight'], movement_family: 'squat_pattern' } },
  { slug: 'walking-lunge', name: 'Walking Lunge', movementCategory: 'squat', equipment: 'bodyweight', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'external_load'], metadata: { requires: ['bodyweight'], movement_family: 'lunge_pattern' } },
  { slug: 'reverse-lunge', name: 'Reverse Lunge', movementCategory: 'squat', equipment: 'bodyweight', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'external_load'], metadata: { requires: ['bodyweight'], movement_family: 'lunge_pattern' } },
  { slug: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', movementCategory: 'squat', equipment: 'dumbbell', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'external_load'], metadata: { requires: ['dumbbells', 'bench'], movement_family: 'lunge_pattern' } },
  { slug: 'step-up', name: 'Step Up', movementCategory: 'squat', equipment: 'dumbbell', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'external_load'], metadata: { requires: ['dumbbells', 'bench'], movement_family: 'lunge_pattern' } },
  { slug: 'hip-thrust', name: 'Barbell Hip Thrust', movementCategory: 'hinge', equipment: 'barbell', muscleGroups: ['glutes', 'hamstrings'], exerciseType: 'strength', loadingMethods: ['external_load'], metadata: { requires: ['barbell', 'bench'], movement_family: 'hinge_pattern' } },
  { slug: 'single-leg-rdl', name: 'Single Leg RDL', movementCategory: 'hinge', equipment: 'dumbbell', muscleGroups: ['hamstrings', 'glutes'], exerciseType: 'strength', loadingMethods: ['external_load'], metadata: { requires: ['dumbbells'], movement_family: 'hinge_pattern' } },
  { slug: 'skull-crusher', name: 'Skull Crusher', movementCategory: 'push', equipment: 'barbell', muscleGroups: ['triceps'], exerciseType: 'strength', metadata: { requires: ['barbell', 'bench'], movement_family: 'triceps' } },
  { slug: 'lateral-lunge', name: 'Lateral Lunge', movementCategory: 'squat', equipment: 'bodyweight', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', loadingMethods: ['bodyweight', 'external_load'], metadata: { requires: ['bodyweight'], movement_family: 'lunge_pattern' } },
  { slug: 'glute-bridge', name: 'Glute Bridge', movementCategory: 'hinge', equipment: 'bodyweight', muscleGroups: ['glutes', 'hamstrings'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'glute_pattern' } },
  { slug: 'landmine-squat', name: 'Landmine Squat', movementCategory: 'squat', equipment: 'barbell', muscleGroups: ['quads', 'glutes', 'core'], exerciseType: 'strength', metadata: { requires: ['landmine'], movement_family: 'squat_pattern' } },
  { slug: 'landmine-rdl', name: 'Landmine RDL', movementCategory: 'hinge', equipment: 'barbell', muscleGroups: ['hamstrings', 'glutes'], exerciseType: 'strength', metadata: { requires: ['landmine'], movement_family: 'hinge_pattern' } },
  { slug: 'sumo-deadlift', name: 'Sumo Deadlift', movementCategory: 'hinge', equipment: 'barbell', muscleGroups: ['glutes', 'hamstrings', 'quads'], exerciseType: 'strength', metadata: { requires: ['barbell', 'rack'], movement_family: 'hinge_pattern' } },
  { slug: 'pistol-squat', name: 'Pistol Squat', movementCategory: 'squat', equipment: 'bodyweight', muscleGroups: ['quads', 'glutes'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'lunge_pattern' } },
  { slug: 'single-leg-calf-raise', name: 'Single Leg Calf Raise', movementCategory: 'other', equipment: 'bodyweight', muscleGroups: ['calves'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'calves' } },
  { slug: 'hanging-leg-raise', name: 'Hanging Leg Raise', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['pull_up_bar'], movement_family: 'core_flexion' } },
  { slug: 'face-pull', name: 'Face Pull', movementCategory: 'pull', equipment: 'cable', muscleGroups: ['shoulders', 'back'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'rear_delt' } },
  { slug: 'hammer-curl', name: 'Hammer Curl', movementCategory: 'pull', equipment: 'dumbbell', muscleGroups: ['biceps'], exerciseType: 'strength', metadata: { requires: ['dumbbells'], movement_family: 'biceps' } },
  { slug: 'plank', name: 'Plank', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'timed', loadingMethods: ['timed_hold'], metadata: { requires: ['bodyweight'], movement_family: 'core' } },
  { slug: 'side-plank', name: 'Side Plank', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core', 'obliques'], exerciseType: 'timed', loadingMethods: ['timed_hold'], metadata: { requires: ['bodyweight'], movement_family: 'core' } },
  { slug: 'crunch', name: 'Crunch', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_flexion' } },
  { slug: 'sit-up', name: 'Sit-Up', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_flexion' } },
  { slug: 'reverse-crunch', name: 'Reverse Crunch', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_flexion' } },
  { slug: 'bicycle-crunch', name: 'Bicycle Crunch', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core', 'obliques'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_rotation' } },
  { slug: 'cable-crunch', name: 'Cable Crunch', movementCategory: 'core', equipment: 'cable', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['machines'], movement_family: 'core_flexion' } },
  { slug: 'dead-bug', name: 'Dead Bug', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_anti_extension' } },
  { slug: 'hollow-hold', name: 'Hollow Hold', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core'], exerciseType: 'timed', loadingMethods: ['timed_hold'], metadata: { requires: ['bodyweight'], movement_family: 'core_anti_extension' } },
  { slug: 'russian-twist', name: 'Russian Twist', movementCategory: 'core', equipment: 'bodyweight', muscleGroups: ['core', 'obliques'], exerciseType: 'strength', metadata: { requires: ['bodyweight'], movement_family: 'core_rotation' } },

  // Cardio — continuous or interval conditioning
  { slug: 'running', name: 'Running', movementCategory: 'cardio', equipment: 'none', muscleGroups: ['legs', 'cardiovascular'], exerciseType: 'cardio' },
  { slug: 'swimming', name: 'Swimming', movementCategory: 'cardio', equipment: 'none', muscleGroups: ['full_body', 'cardiovascular'], exerciseType: 'cardio' },
  { slug: 'cycling', name: 'Cycling', movementCategory: 'cardio', equipment: 'bike', muscleGroups: ['legs', 'cardiovascular'], exerciseType: 'cardio' },
  { slug: 'rowing', name: 'Rowing', movementCategory: 'cardio', equipment: 'rower', muscleGroups: ['back', 'legs', 'cardiovascular'], exerciseType: 'cardio' },
  { slug: 'recovery-walk', name: 'Recovery Walk', movementCategory: 'cardio', equipment: 'none', muscleGroups: ['legs', 'cardiovascular'], exerciseType: 'cardio' },
];

export function catalogExerciseBySlug(slug: string): CatalogExercise | undefined {
  return SYSTEM_EXERCISE_CATALOG.find((exercise) => exercise.slug === slug);
}

export function exerciseCountsByType(): Record<ExerciseType, number> {
  const counts: Record<ExerciseType, number> = {
    strength: 0,
    bodyweight: 0,
    timed: 0,
    cardio: 0,
  };
  for (const exercise of SYSTEM_EXERCISE_CATALOG) {
    counts[exercise.exerciseType] += 1;
  }
  return counts;
}

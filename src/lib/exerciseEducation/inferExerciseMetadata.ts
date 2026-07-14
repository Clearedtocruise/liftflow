import type { MovementCategory } from '@/types/common';
import type { ExerciseType } from '@/types/exerciseClassification';

export type InferredExerciseMetadata = {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  requires: string[];
  movementCategory: MovementCategory;
  movementPattern: string;
  exerciseType: ExerciseType;
  isBodyweight: boolean;
  isTimed: boolean;
  feelShould: string[];
  feelShouldNot: string[];
};

type InferenceInput = {
  name: string;
  slug?: string;
  category?: MovementCategory;
  equipment?: string;
  muscleGroups?: string[];
  secondaryMuscles?: string[];
  exerciseType?: ExerciseType;
  requires?: string[];
  movementFamily?: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function matches(name: string, keywords: string[]): boolean {
  return keywords.some((k) => name.includes(k));
}

function equipmentDefaultFromName(name: string): string | null {
  if (matches(name, ['face pull'])) return 'cable';
  if (matches(name, ['lat pulldown', 'pulldown']) && !matches(name, ['band'])) return 'cable';
  if (matches(name, ['pallof'])) return 'cable';
  if (matches(name, ['nordic'])) return 'bodyweight';
  if (matches(name, ['running', 'sprint', 'jog']) && !matches(name, ['dumbbell', 'db ', 'farmer'])) {
    return 'bodyweight';
  }
  if (matches(name, ['lateral raise', 'front raise', 'rear delt raise'])) {
    return 'dumbbell';
  }
  if (matches(name, ['goblet', 'farmer', 'dumbbell', 'db '])) return 'dumbbell';
  if (matches(name, ['reverse fly', 'rear delt fly'])) return 'dumbbell';
  if (matches(name, ['walking lunge', 'pull-up', 'pull up', 'chin-up', 'chin up', 'dip', 'plank', 'push-up', 'push up'])) {
    return 'bodyweight';
  }
  return null;
}
function equipmentFromName(name: string): { equipment: string; requires: string[] } | null {
  const rules: Array<{ keys: string[]; equipment: string; requires: string[] }> = [
    { keys: ['smith '], equipment: 'machine', requires: ['machines'] },
    { keys: ['cable '], equipment: 'cable', requires: ['machines'] },
    { keys: ['machine '], equipment: 'machine', requires: ['machines'] },
    { keys: ['band '], equipment: 'bands', requires: ['bands'] },
    { keys: ['kettlebell ', 'kb '], equipment: 'kettlebell', requires: ['dumbbells'] },
    { keys: ['barbell lateral', 'bb lateral'], equipment: 'barbell', requires: ['barbell', 'rack'] },
    { keys: ['barbell ', 'bb '], equipment: 'barbell', requires: ['barbell', 'rack'] },
    { keys: ['dumbbell ', 'db '], equipment: 'dumbbell', requires: ['dumbbells'] },
    { keys: ['trap bar '], equipment: 'barbell', requires: ['barbell', 'rack'] },
    { keys: ['plate '], equipment: 'dumbbell', requires: ['dumbbells'] },
    { keys: ['bodyweight', 'push-up', 'push up', 'pull-up', 'pull up', 'chin-up', 'chin up'], equipment: 'bodyweight', requires: ['bodyweight'] },
  ];

  for (const rule of rules) {
    if (matches(name, rule.keys)) {
      return { equipment: rule.equipment, requires: rule.requires };
    }
  }
  return null;
}

function musclesFromName(name: string): { primary: string[]; secondary: string[] } {
  if (matches(name, ['neck'])) {
    return { primary: ['neck'], secondary: ['upper traps'] };
  }
  if (matches(name, ['reverse fly', 'rear delt fly', 'rear-delt fly', 'reverse fly machine'])) {
    return { primary: ['rear delts', 'rhomboids'], secondary: ['mid traps', 'rotator cuff'] };
  }
  if (matches(name, ['face pull', 'pull-apart', 'pull apart', 'band pull'])) {
    return { primary: ['rear delts', 'rhomboids'], secondary: ['mid traps', 'rotator cuff'] };
  }
  if (matches(name, ['thruster', 'man maker', 'clean and press', 'squat to press'])) {
    return { primary: ['quads', 'glutes', 'shoulders'], secondary: ['triceps', 'core'] };
  }
  if (matches(name, ['lat pulldown', 'pulldown', 'pull-up', 'pull up', 'pullup', 'chin-up', 'chin up', 'row'])) {
    const secondary = matches(name, ['row']) ? ['biceps', 'rear delts'] : ['biceps', 'rear delts'];
    return { primary: ['lats', 'mid back'], secondary };
  }
  if (matches(name, ['bench', 'push-up', 'push up', 'chest press', 'pec ', 'fly', 'crossover']) && !matches(name, ['reverse fly', 'rear delt'])) {
    return { primary: ['chest'], secondary: ['front delts', 'triceps'] };
  }
  if (matches(name, ['lateral raise', 'front raise', 'rear delt raise', 'arnold press'])) {
    return { primary: ['shoulders'], secondary: ['upper traps', 'triceps'] };
  }
  if (matches(name, ['shrug'])) {
    return { primary: ['upper traps'], secondary: ['forearms'] };
  }
  if (matches(name, ['goblet squat', 'goblet'])) {
    return { primary: ['quads', 'glutes'], secondary: ['core'] };
  }
  if (matches(name, ['farmer carry', 'farmer walk', 'farmer'])) {
    return { primary: ['grip', 'traps'], secondary: ['core', 'forearms'] };
  }
  if (matches(name, ['glute kickback', 'glute kick-back', 'donkey kick'])) {
    return { primary: ['glutes'], secondary: ['hamstrings', 'core'] };
  }
  if (matches(name, ['leg curl', 'hamstring curl', 'nordic'])) {
    return { primary: ['hamstrings'], secondary: ['glutes', 'calves'] };
  }
  if (matches(name, ['curl']) && !matches(name, ['leg curl', 'hamstring curl', 'neck harness curl', 'nordic'])) {
    return { primary: ['biceps'], secondary: ['forearms'] };
  }
  if (matches(name, ['tricep', 'triceps', 'pushdown', 'skull crusher', 'dip', 'kickback'])) {
    return { primary: ['triceps'], secondary: ['chest', 'shoulders'] };
  }
  if (matches(name, ['squat', 'leg press', 'lunge', 'split squat', 'step-up', 'step up', 'goblet'])) {
    return { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] };
  }
  if (matches(name, ['deadlift', 'rdl', 'romanian', 'good morning', 'hip thrust', 'glute bridge', 'swing', 'hinge'])) {
    return { primary: ['hamstrings', 'glutes'], secondary: ['lower back', 'core'] };
  }
  if (matches(name, ['leg extension'])) {
    return { primary: ['quads'], secondary: [] };
  }
  if (matches(name, ['calf', 'toe raise'])) {
    return { primary: ['calves'], secondary: [] };
  }
  if (matches(name, ['crunch', 'sit-up', 'sit up', 'plank', 'dead bug', 'leg raise', 'pallof', 'wood chop', 'russian twist', 'oblique', 'core'])) {
    return { primary: ['core'], secondary: ['hip flexors'] };
  }
  if (matches(name, ['carry', 'farmer', 'yoke', 'suitcase', 'zercher walk'])) {
    return { primary: ['core', 'grip'], secondary: ['traps', 'glutes'] };
  }
  if (matches(name, ['run', 'running', 'sprint', 'jog', 'cycle', 'bike', 'rower', 'elliptical', 'swim', 'cardio', 'interval', 'burpee', 'jump rope'])) {
    return { primary: ['cardiovascular'], secondary: ['full body'] };
  }
  if (matches(name, ['wrist', 'forearm', 'grip'])) {
    return { primary: ['forearms'], secondary: ['grip'] };
  }

  return { primary: ['full body'], secondary: [] };
}

function categoryFromName(name: string, muscles: string[]): MovementCategory {
  if (matches(name, ['run', 'running', 'sprint', 'cycle', 'bike', 'swim', 'cardio', 'interval', 'burpee', 'jump rope'])) {
    return 'cardio';
  }
  if (matches(name, ['carry', 'farmer', 'yoke', 'suitcase', 'walk on toes'])) {
    return 'carry';
  }
  if (matches(name, ['squat', 'lunge', 'leg press', 'split squat', 'step-up', 'step up', 'goblet'])) {
    return 'squat';
  }
  if (matches(name, ['deadlift', 'rdl', 'romanian', 'good morning', 'hip thrust', 'glute bridge', 'swing', 'leg curl', 'back extension', 'hyperextension'])) {
    return 'hinge';
  }
  if (matches(name, ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'chin-up', 'chin up', 'reverse fly', 'rear delt', 'face pull'])) {
    return 'pull';
  }
  if (matches(name, ['crunch', 'plank', 'pallof', 'wood chop', 'russian twist', 'dead bug', 'leg raise', 'oblique'])) {
    return 'core';
  }
  if (matches(name, ['press', 'push-up', 'push up', 'bench', 'dip', 'fly', 'crossover', 'thruster']) && !matches(name, ['leg press'])) {
    return 'push';
  }
  if (muscles.includes('cardiovascular')) return 'cardio';
  return 'other';
}

function patternFromName(name: string): string {
  if (matches(name, ['reverse fly', 'rear delt'])) return 'rear_delt_fly';
  if (matches(name, ['thruster', 'clean and press', 'squat to press'])) return 'squat_press_complex';
  if (matches(name, ['neck'])) return 'neck_isolation';
  if (matches(name, ['squat', 'leg press', 'goblet'])) return 'squat_pattern';
  if (matches(name, ['lunge', 'split squat', 'step-up', 'step up'])) return 'lunge_pattern';
  if (matches(name, ['deadlift', 'rdl', 'romanian', 'good morning', 'swing'])) return 'hinge_pattern';
  if (matches(name, ['row', 'pulldown', 'pull-up', 'pull up'])) return 'horizontal_pull';
  if (matches(name, ['bench', 'push-up', 'push up', 'press', 'dip'])) return 'horizontal_press';
  if (matches(name, ['overhead press', 'shoulder press', 'military press'])) return 'vertical_press';
  if (matches(name, ['curl'])) return 'elbow_flexion';
  if (matches(name, ['tricep', 'pushdown', 'skull crusher', 'extension'])) return 'elbow_extension';
  if (matches(name, ['carry', 'farmer', 'yoke'])) return 'carry';
  if (matches(name, ['plank', 'crunch', 'twist', 'pallof'])) return 'core_stability';
  if (matches(name, ['run', 'cardio', 'interval'])) return 'cardio_conditioning';
  return 'general_movement';
}

function exerciseTypeFromName(name: string): { type: ExerciseType; isTimed: boolean; isBodyweight: boolean } {
  const n = name;
  if (matches(n, ['interval', 'running', 'run', 'sprint', 'cycle', 'bike', 'rower', 'elliptical', 'swim', 'cardio', 'jump rope'])) {
    return { type: 'cardio', isTimed: true, isBodyweight: false };
  }
  if (
    matches(n, ['plank', 'wall sit', 'isometric', 'hollow hold']) ||
    (matches(n, ['hold']) && !matches(n, ['chin', 'neck', 'farmer', 'goblet']))
  ) {
    return { type: 'timed', isTimed: true, isBodyweight: false };
  }
  if (matches(n, ['push-up', 'push up', 'pull-up', 'pull up', 'pullup', 'chin-up', 'chin up', 'dip'])) {
    return { type: 'strength', isTimed: false, isBodyweight: true };
  }
  if (matches(n, ['burpee', 'bodyweight'])) {
    return { type: 'bodyweight', isTimed: false, isBodyweight: true };
  }
  return { type: 'strength', isTimed: false, isBodyweight: false };
}

function feelFromMuscles(primary: string[], secondary: string[]): { should: string[]; shouldNot: string[] } {
  const should = primary.slice(0, 3).map((m) => `${m} working during the effort phase`);
  const shouldNot: string[] = [];

  if (primary.includes('rear delts') || primary.includes('rhomboids')) {
    shouldNot.push('chest or front delts taking over', 'biceps doing most of the pull');
  }
  if (primary.includes('neck')) {
    shouldNot.push('sharp pain in cervical spine', 'dizziness or numbness');
  }
  if (primary.includes('hamstrings') || primary.includes('glutes')) {
    shouldNot.push('lower back strain or pinching');
  }
  if (primary.includes('quads') || primary.includes('glutes')) {
    shouldNot.push('knee pain from collapsing inward');
  }
  if (primary.includes('chest')) {
    shouldNot.push('shoulders shrugging up to your ears');
  }
  if (primary.includes('cardiovascular')) {
    shouldNot.push('dizziness, chest pain, or inability to maintain form');
  }
  if (shouldNot.length === 0 && secondary.length) {
    shouldNot.push(`${secondary[0]} compensating instead of ${primary[0]}`);
  }
  if (shouldNot.length === 0) {
    shouldNot.push('joint pain or sharp discomfort');
  }

  return { should, shouldNot };
}

/** Infer correct metadata from exercise name — overrides corrupted catalog rows. */
export function inferExerciseMetadata(input: InferenceInput): InferredExerciseMetadata {
  const name = normalizeName(input.name);
  const muscles = musclesFromName(name);
  const equipmentGuess = equipmentFromName(name);
  const typeGuess = exerciseTypeFromName(name);
  const category = categoryFromName(name, muscles.primary);
  const pattern = patternFromName(name);
  const feel = feelFromMuscles(muscles.primary, muscles.secondary);

  const equipment = equipmentGuess?.equipment ?? equipmentDefaultFromName(name) ?? input.equipment ?? 'bodyweight';
  const requires = equipmentGuess?.requires ?? input.requires ?? (equipment === 'bodyweight' ? ['bodyweight'] : [equipment]);

  return {
    primaryMuscles: muscles.primary,
    secondaryMuscles: muscles.secondary,
    equipment,
    requires,
    movementCategory: category,
    movementPattern: pattern,
    exerciseType: typeGuess.type,
    isBodyweight: typeGuess.isBodyweight || equipment === 'bodyweight',
    isTimed: typeGuess.isTimed,
    feelShould: feel.should,
    feelShouldNot: feel.shouldNot,
  };
}

export type MetadataMismatch = {
  field: string;
  stored: string;
  expected: string;
};

/** Compare stored catalog row against name-based inference. */
export function detectMetadataMismatches(input: InferenceInput): MetadataMismatch[] {
  const inferred = inferExerciseMetadata(input);
  const mismatches: MetadataMismatch[] = [];

  if (input.category && input.category !== inferred.movementCategory) {
    mismatches.push({ field: 'category', stored: input.category, expected: inferred.movementCategory });
  }
  if (input.equipment && input.equipment !== inferred.equipment && equipmentFromName(normalizeName(input.name))) {
    mismatches.push({ field: 'equipment', stored: input.equipment, expected: inferred.equipment });
  }
  if (input.exerciseType && input.exerciseType !== inferred.exerciseType) {
    mismatches.push({ field: 'exercise_type', stored: input.exerciseType, expected: inferred.exerciseType });
  }
  const storedMuscle = input.muscleGroups?.[0];
  const expectedMuscle = inferred.primaryMuscles[0];
  if (storedMuscle && expectedMuscle && storedMuscle !== expectedMuscle && storedMuscle !== 'full body') {
    const name = normalizeName(input.name);
    if (name.includes('interval') && input.exerciseType === 'cardio' && storedMuscle === 'cardiovascular') {
      return mismatches;
    }
    if (name.includes('reverse fly') && storedMuscle === 'shoulders') {
      return mismatches;
    }
    const storedSet = new Set((input.muscleGroups ?? []).map((m) => m.toLowerCase()));
    const overlap = inferred.primaryMuscles.some((m) => storedSet.has(m.toLowerCase()) || storedSet.has(m.split(' ')[0] ?? ''));
    if (!overlap) {
      mismatches.push({
        field: 'muscle_groups',
        stored: (input.muscleGroups ?? []).join(', '),
        expected: inferred.primaryMuscles.join(', '),
      });
    }
  }

  return mismatches;
}

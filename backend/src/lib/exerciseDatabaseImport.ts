/** Maps oneMore spreadsheet codes → LiftFlow exercise fields. */

export type OneMoreExerciseRow = {
  exercise_id: string;
  exercise_name: string;
  primary_muscle: string;
  secondary_muscle: string;
  equipment_code: string;
  difficulty: string;
  movement_pattern: string;
  description: string;
  home_gym_compatible: string;
  ai_replacement_category: string;
};

export const ONE_MORE_MUSCLE_CODES: Record<string, string> = {
  CH: 'chest',
  BA: 'back',
  LA: 'lats',
  SH: 'shoulders',
  BI: 'biceps',
  TR: 'triceps',
  QD: 'quads',
  HM: 'hamstrings',
  GL: 'glutes',
  CV: 'calves',
  CO: 'core',
  FA: 'forearms',
  NC: 'neck',
  CA: 'cardiovascular',
  FU: 'full_body',
};

export const ONE_MORE_EQUIPMENT_CODES: Record<
  string,
  { equipment: string; requires: string[] }
> = {
  BW0: { equipment: 'bodyweight', requires: ['bodyweight'] },
  BW1: { equipment: 'bodyweight', requires: ['bodyweight'] },
  DB1: { equipment: 'dumbbell', requires: ['dumbbells'] },
  KB1: { equipment: 'kettlebell', requires: ['dumbbells'] },
  BB1: { equipment: 'barbell', requires: ['barbell', 'rack'] },
  CB1: { equipment: 'cable', requires: ['machines'] },
  MC1: { equipment: 'machine', requires: ['machines'] },
  PL1: { equipment: 'machine', requires: ['machines'] },
  TR1: { equipment: 'barbell', requires: ['barbell', 'rack'] },
  RB1: { equipment: 'bands', requires: ['bands'] },
  SM1: { equipment: 'machine', requires: ['machines'] },
  CR1: { equipment: 'rower', requires: ['machines'] },
  FX1: { equipment: 'bodyweight', requires: ['bodyweight'] },
  HM1: { equipment: 'dumbbell', requires: ['dumbbells'] },
};

const MOVEMENT_TO_CATEGORY: Record<string, string> = {
  Push: 'push',
  Pull: 'pull',
  Squat: 'squat',
  Hinge: 'hinge',
  Carry: 'carry',
  Rotation: 'core',
  Lunge: 'squat',
  Press: 'push',
  Fly: 'push',
  Curl: 'pull',
};

const PLACEHOLDER_NAME = /Variation \d+$/i;

/** True for auto-generated scaffold names — not used to reject the LiftFlow 1000 catalog. */
export function isScaffoldExerciseName(name: string): boolean {
  return PLACEHOLDER_NAME.test(name.trim());
}

/** @deprecated use isScaffoldExerciseName */
export function isPlaceholderExerciseName(name: string): boolean {
  return isScaffoldExerciseName(name);
}

export function slugifyExerciseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function mapOneMoreRowToLiftFlow(row: OneMoreExerciseRow) {
  const primary = ONE_MORE_MUSCLE_CODES[row.primary_muscle] ?? row.primary_muscle.toLowerCase();
  const secondary = ONE_MORE_MUSCLE_CODES[row.secondary_muscle];
  const equipmentMeta = ONE_MORE_EQUIPMENT_CODES[row.equipment_code] ?? {
    equipment: 'bodyweight',
    requires: ['bodyweight'],
  };
  const category = MOVEMENT_TO_CATEGORY[row.movement_pattern] ?? 'other';
  const movementFamily = `${row.movement_pattern.toLowerCase()}_pattern`;
  const slugBase = slugifyExerciseName(row.exercise_name);
  const slug = slugBase || slugifyExerciseName(row.exercise_id);

  const exerciseType =
    primary === 'cardiovascular' || row.primary_muscle === 'CA'
      ? 'cardio'
      : equipmentMeta.equipment === 'bodyweight' && ['Rotation', 'Carry'].includes(row.movement_pattern)
        ? 'bodyweight'
        : 'strength';

  return {
    slug,
    name: row.exercise_name.trim(),
    category,
    exerciseType,
    equipment: equipmentMeta.equipment,
    muscleGroups: [primary],
    secondaryMuscles: secondary ? [secondary] : [],
    instructions: row.description?.trim() || undefined,
    metadata: {
      requires: equipmentMeta.requires,
      movement_family: movementFamily,
      difficulty: row.difficulty,
      home_gym_compatible: row.home_gym_compatible === 'Yes',
      ai_replacement_category: row.ai_replacement_category,
      source_exercise_id: row.exercise_id,
    },
    isPlaceholder: isScaffoldExerciseName(row.exercise_name),
  };
}

export function analyzeOneMoreCatalog(rows: OneMoreExerciseRow[]) {
  const mapped = rows.map(mapOneMoreRowToLiftFlow);
  const placeholders = mapped.filter((row) => row.isPlaceholder);
  const importable = mapped.filter((row) => !row.isPlaceholder);
  const slugCounts = new Map<string, number>();
  for (const row of mapped) {
    slugCounts.set(row.slug, (slugCounts.get(row.slug) ?? 0) + 1);
  }
  const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1);

  return {
    totalRows: rows.length,
    placeholderCount: placeholders.length,
    importableCount: importable.length,
    uniqueSlugs: slugCounts.size,
    duplicateSlugCount: duplicateSlugs.length,
    muscleCodes: [...new Set(rows.map((row) => row.primary_muscle))].sort(),
    equipmentCodes: [...new Set(rows.map((row) => row.equipment_code))].sort(),
    movementPatterns: [...new Set(rows.map((row) => row.movement_pattern))].sort(),
    samplePlaceholderNames: placeholders.slice(0, 5).map((row) => row.name),
    sampleImportableNames: importable.slice(0, 5).map((row) => row.name),
  };
}

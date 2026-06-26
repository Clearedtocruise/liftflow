#!/usr/bin/env node
/**
 * Dev-client spotlight validation — exercises runtime education correction.
 * Runs actual TS modules (same code path as the app).
 *
 * Usage: npm run validate:exercise-education-spotlight
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { educationHasRequiredFields } from '../src/lib/exerciseEducation/buildExerciseEducation.ts';
import { inferExerciseMetadata } from '../src/lib/exerciseEducation/inferExerciseMetadata.ts';
import { guideHasStructure, resolveExerciseFormGuide } from '../src/lib/exerciseFormGuides.ts';
import {
    inferLoadingMethodFromHistory,
    supportedLoadingMethods,
} from '../src/lib/exerciseLoadingMethod.ts';
import type { MovementCategory } from '../src/types/common.ts';
import type { ExerciseType } from '../src/types/exerciseClassification.ts';
import type { Exercise } from '../src/types/workout.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const INSERT_PATTERN =
  /values \('([^']+)', '([^']+)', '([^']+)', '([^']+)', array\[([^\]]+)\], true, '([^']+)', '(\{.*?\})'::jsonb\)/g;

function loadCatalogBySlug(): Map<string, Record<string, string>> {
  const migration = path.join(root, 'supabase/migrations/024_import_1000_exercise_catalog.sql');
  const seed002 = path.join(root, 'supabase/migrations/002_seed_and_storage.sql');
  const seed022 = path.join(root, 'supabase/migrations/022_expand_leg_exercise_catalog.sql');
  const bySlug = new Map<string, Record<string, string>>();

  function ingestMigration(file: string) {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8').replace(/\n\s+/g, ' ');
    let match;
    while ((match = INSERT_PATTERN.exec(text)) !== null) {
      const [, name, slug, category, equipment, musclesRaw, exerciseType] = match;
      const muscle = musclesRaw.replace(/'/g, '').split(',')[0]?.trim() ?? '';
      bySlug.set(slug, { name, slug, category, equipment, muscle, exerciseType });
    }
  }

  function ingestSeed(file: string) {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    const pat =
      /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*array\[([^\]]+)\],\s*true(?:,\s*'([^']+)')?\)/g;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const [, name, slug, category, equipment, musclesRaw, exerciseType] = m;
      const muscle = musclesRaw.replace(/'/g, '').split(',')[0]?.trim() ?? '';
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          name,
          slug,
          category,
          equipment,
          muscle,
          exerciseType: exerciseType ?? 'strength',
        });
      }
    }
  }

  ingestMigration(migration);
  ingestMigration(seed022);
  ingestSeed(seed002);
  return bySlug;
}

const FALLBACK_CATALOG_ROWS: Record<string, Record<string, string>> = {
  'chin-up': {
    name: 'Chin Up',
    slug: 'chin-up',
    category: 'pull',
    equipment: 'bodyweight',
    muscle: 'back',
    exerciseType: 'strength',
  },
};

function rowToExercise(row: Record<string, string>): Exercise {
  return {
    id: `spotlight-${row.slug}`,
    name: row.name,
    slug: row.slug,
    category: row.category as MovementCategory,
    exerciseType: row.exerciseType as ExerciseType,
    equipment: row.equipment,
    muscleGroups: [row.muscle],
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function syntheticRow(name: string, slug: string, overrides: Partial<Record<string, string>> = {}) {
  return {
    name,
    slug,
    category: overrides.category ?? 'other',
    equipment: overrides.equipment ?? 'dumbbell',
    muscle: overrides.muscle ?? 'full body',
    exerciseType: overrides.exerciseType ?? 'strength',
  };
}

type SpotlightCase = {
  label: string;
  slug: string;
  synthetic?: ReturnType<typeof syntheticRow>;
  expect: {
    primaryIncludes: string[];
    secondaryIncludes?: string[];
    equipment: string;
    exerciseType: ExerciseType;
    loadingMethods: string[];
    defaultLoading: string;
    guideMustInclude: string[];
    guideMustNotInclude: string[];
    allowGenericBodyweight?: boolean;
  };
};

const SPOTLIGHT: SpotlightCase[] = [
  {
    label: 'Reverse Fly',
    slug: 'reverse-fly',
    expect: {
      primaryIncludes: ['rear delts'],
      secondaryIncludes: ['rhomboids'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['rear delt', 'shoulder blades', 'not chest'],
      guideMustNotInclude: ['hugging arc', 'chest contract', 'bodyweight only'],
    },
  },
  {
    label: 'Dumbbell Thruster Intervals',
    slug: 'dumbbell-thruster-intervals',
    expect: {
      primaryIncludes: ['quads', 'shoulders'],
      equipment: 'dumbbell',
      exerciseType: 'cardio',
      loadingMethods: ['distance', 'external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['squat', 'press', 'dumbbell'],
      guideMustNotInclude: ['bodyweight only', 'bench', 'nipple line'],
    },
  },
  {
    label: 'Neck Extension Press',
    slug: 'neck-extension-press',
    expect: {
      primaryIncludes: ['neck'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['neck', 'light', 'controlled'],
      guideMustNotInclude: ['elbows at 45', 'bench', 'press back up in a slight arc'],
    },
  },
  {
    label: 'Walking Lunge',
    slug: 'walking-lunge',
    expect: {
      primaryIncludes: ['quads', 'glutes'],
      equipment: 'bodyweight',
      exerciseType: 'strength',
      loadingMethods: ['bodyweight', 'external_load'],
      defaultLoading: 'bodyweight',
      guideMustInclude: ['step', 'knee', 'front'],
      guideMustNotInclude: ['bodyweight only — use bodyweight only'],
      allowGenericBodyweight: true,
    },
  },
  {
    label: 'Pull Up',
    slug: 'pull-up',
    expect: {
      primaryIncludes: ['lats'],
      equipment: 'bodyweight',
      exerciseType: 'strength',
      loadingMethods: ['bodyweight', 'bodyweight_plus_weight'],
      defaultLoading: 'bodyweight',
      guideMustInclude: ['pull', 'elbows', 'lats'],
      guideMustNotInclude: ['hugging arc', 'chest contract'],
      allowGenericBodyweight: true,
    },
  },
  {
    label: 'Chin Up',
    slug: 'chin-up',
    expect: {
      primaryIncludes: ['lats'],
      equipment: 'bodyweight',
      exerciseType: 'strength',
      loadingMethods: ['bodyweight', 'bodyweight_plus_weight'],
      defaultLoading: 'bodyweight',
      guideMustInclude: ['pull', 'elbows'],
      guideMustNotInclude: ['hugging arc'],
      allowGenericBodyweight: true,
    },
  },
  {
    label: 'Dip',
    slug: 'dip',
    expect: {
      primaryIncludes: ['triceps'],
      equipment: 'bodyweight',
      exerciseType: 'strength',
      loadingMethods: ['bodyweight', 'bodyweight_plus_weight'],
      defaultLoading: 'bodyweight',
      guideMustInclude: ['elbow', 'extend'],
      guideMustNotInclude: ['squat', 'hugging arc'],
      allowGenericBodyweight: true,
    },
  },
  {
    label: 'Plank',
    slug: 'plank',
    expect: {
      primaryIncludes: ['core'],
      equipment: 'bodyweight',
      exerciseType: 'timed',
      loadingMethods: ['timed_hold'],
      defaultLoading: 'timed_hold',
      guideMustInclude: ['hold', 'core', 'straight line'],
      guideMustNotInclude: ['curl', 'press back up'],
      allowGenericBodyweight: true,
    },
  },
  {
    label: 'Dumbbell Shrug',
    slug: 'dumbbell-shrug',
    synthetic: syntheticRow('Dumbbell Shrug', 'dumbbell-shrug', {
      category: 'pull',
      equipment: 'machine',
      muscle: 'biceps',
      exerciseType: 'strength',
    }),
    expect: {
      primaryIncludes: ['upper traps'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['trap', 'shoulder'],
      guideMustNotInclude: ['curl', 'squat', 'hugging arc'],
    },
  },
  {
    label: 'Lateral Raise',
    slug: 'lateral-raise',
    expect: {
      primaryIncludes: ['shoulders'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['side delt', 'shoulder height'],
      guideMustNotInclude: ['hugging arc', 'chest contract', 'bench'],
    },
  },
  {
    label: 'Romanian Deadlift',
    slug: 'romanian-deadlift',
    expect: {
      primaryIncludes: ['hamstrings', 'glutes'],
      equipment: 'barbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['hamstring', 'hinge', 'glute'],
      guideMustNotInclude: ['hugging arc', 'curl up'],
    },
  },
  {
    label: 'Goblet Squat',
    slug: 'goblet-squat',
    expect: {
      primaryIncludes: ['quads', 'glutes'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['squat', 'chest up'],
      guideMustNotInclude: ['lats', 'hugging arc'],
    },
  },
  {
    label: 'Bench Press',
    slug: 'bench-press',
    expect: {
      primaryIncludes: ['chest'],
      equipment: 'barbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['chest', 'barbell', 'press'],
      guideMustNotInclude: ['rear delt', 'neck', 'bodyweight only'],
    },
  },
  {
    label: 'Barbell Row',
    slug: 'barbell-row',
    expect: {
      primaryIncludes: ['lats'],
      equipment: 'barbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load'],
      defaultLoading: 'external_load',
      guideMustInclude: ['row', 'elbows', 'back'],
      guideMustNotInclude: ['hugging arc', 'squat to depth'],
    },
  },
  {
    label: 'Farmer Carry',
    slug: 'farmer-carry',
    expect: {
      primaryIncludes: ['grip', 'traps'],
      equipment: 'dumbbell',
      exerciseType: 'strength',
      loadingMethods: ['external_load', 'timed_hold'],
      defaultLoading: 'external_load',
      guideMustInclude: ['walk', 'core', 'shoulders level'],
      guideMustNotInclude: ['hugging arc', 'curl'],
    },
  },
];

function guideText(guide: ReturnType<typeof resolveExerciseFormGuide>): string {
  if (!guide) return '';
  return [
    guide.summary,
    guide.equipment,
    guide.setup,
    guide.startPosition,
    guide.movement,
    guide.endPosition,
    guide.muscleFocus,
    ...(guide.coachingCues ?? []),
    ...(guide.commonMistakes ?? []),
    ...(guide.steps ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function includesAll(haystack: string, needles: string[]) {
  return needles.every((n) => haystack.includes(n.toLowerCase()));
}

function includesNone(haystack: string, needles: string[]) {
  return needles.every((n) => !haystack.includes(n.toLowerCase()));
}

function correctedExercise(base: Exercise, inferred: ReturnType<typeof inferExerciseMetadata>): Exercise {
  return {
    ...base,
    category: inferred.movementCategory,
    exerciseType: inferred.exerciseType,
    equipment: inferred.equipment,
    muscleGroups: inferred.primaryMuscles,
    secondaryMuscles: inferred.secondaryMuscles,
  };
}

let fail = 0;

function check(ok: boolean, label: string, detail = '') {
  console.log(`    ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail += 1;
}

function validateUiWiring() {
  console.log('\n## Guide sheet UI wiring\n');
  const sheet = fs.readFileSync(
    path.join(root, 'src/components/workout/execution/ExerciseGuideSheet.tsx'),
    'utf8',
  );
  const screen = fs.readFileSync(
    path.join(root, 'src/components/workout/execution/ActiveWorkoutScreen.tsx'),
    'utf8',
  );

  check(sheet.includes('<Modal'), 'ExerciseGuideSheet uses Modal');
  check(sheet.includes('<ScrollView'), 'ExerciseGuideSheet scrollable');
  check(sheet.includes('flexGrow: 1'), 'Scroll content flexGrow');
  check(sheet.includes('ExerciseMovementMedia'), 'Movement media / fallback card');
  check(sheet.includes('What it should feel like'), 'Feel-like section');
  check(!sheet.includes('ScrollView') || !sheet.match(/<ScrollView[\s\S]*<ScrollView/), 'No nested ScrollViews');
  check(screen.includes('<ExerciseGuideSheet'), 'ActiveWorkoutScreen mounts guide sheet');
  check(screen.includes('exerciseGuideOpen'), 'Guide open state');
}

function main() {
  console.log('=== Exercise Education Spotlight (dev-client) ===\n');
  const catalog = loadCatalogBySlug();

  for (const spot of SPOTLIGHT) {
    console.log(`\n## ${spot.label}\n`);
    const raw = spot.synthetic ?? catalog.get(spot.slug) ?? FALLBACK_CATALOG_ROWS[spot.slug];
    if (!raw) {
      check(false, 'Catalog row found', `missing slug ${spot.slug}`);
      continue;
    }

    const dbExercise = rowToExercise(raw);
    const inferred = inferExerciseMetadata({
      name: dbExercise.name,
      slug: dbExercise.slug,
      category: dbExercise.category,
      equipment: dbExercise.equipment,
      muscleGroups: dbExercise.muscleGroups,
      exerciseType: dbExercise.exerciseType,
    });
    const exercise = correctedExercise(dbExercise, inferred);
    const guide = resolveExerciseFormGuide(dbExercise);
    const text = guideText(guide);
    const loadingMethods = supportedLoadingMethods(exercise, exercise.slug);
    const defaultLoading = inferLoadingMethodFromHistory(exercise, exercise.slug, null, null);

    console.log(`  DB (raw): muscles=${dbExercise.muscleGroups?.join(',')} equip=${dbExercise.equipment} type=${dbExercise.exerciseType}`);
    console.log(`  Runtime:  muscles=${inferred.primaryMuscles.join(',')} equip=${inferred.equipment} type=${inferred.exerciseType}`);
    console.log(`  Loading:  [${loadingMethods.join(', ')}] default=${defaultLoading}`);

    for (const muscle of spot.expect.primaryIncludes) {
      check(
        inferred.primaryMuscles.some((m) => m.toLowerCase().includes(muscle.toLowerCase())),
        `Primary includes "${muscle}"`,
        inferred.primaryMuscles.join(', '),
      );
    }
    if (spot.expect.secondaryIncludes) {
      for (const muscle of spot.expect.secondaryIncludes) {
        const allMuscles = [...inferred.primaryMuscles, ...inferred.secondaryMuscles];
        check(
          allMuscles.some((m) => m.toLowerCase().includes(muscle.toLowerCase())),
          `Secondary includes "${muscle}"`,
          allMuscles.join(', '),
        );
      }
    }

    check(inferred.equipment === spot.expect.equipment, 'Equipment', `got ${inferred.equipment}`);
    check(inferred.exerciseType === spot.expect.exerciseType, 'Exercise type', `got ${inferred.exerciseType}`);

    const loadingOk = spot.expect.loadingMethods.some((m) => loadingMethods.includes(m as never));
    check(loadingOk, 'Loading methods', `[${loadingMethods.join(', ')}]`);
    check(
      defaultLoading === spot.expect.defaultLoading ||
        spot.expect.loadingMethods.includes(defaultLoading),
      'Default loading',
      defaultLoading,
    );

    check(guide != null && guideHasStructure(guide), 'Structured form guide');
    check(educationHasRequiredFields(guide), 'Required education fields');
    check(includesAll(text, spot.expect.guideMustInclude), 'Guide content', spot.expect.guideMustInclude.join(' | '));
    check(includesNone(text, spot.expect.guideMustNotInclude), 'No wrong guide patterns');

    const genericBodyweight =
      text.includes('no external weight — use bodyweight only') &&
      !spot.expect.allowGenericBodyweight &&
      !['bodyweight', 'timed'].includes(spot.expect.equipment);
    check(!genericBodyweight, 'No inappropriate bodyweight-only fallback');
  }

  validateUiWiring();

  console.log(`\n=== Spotlight validation: ${fail === 0 ? 'PASS' : 'FAIL'} (${fail} failed) ===\n`);
  if (fail > 0) {
    console.log('Fix failures before Supabase metadata migration.\n');
  } else {
    console.log('Ready for dev-client manual spot-check on device. No Supabase migration needed yet.\n');
  }
  process.exit(fail === 0 ? 0 : 1);
}

main();

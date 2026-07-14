#!/usr/bin/env node
/**
 * Generate structured form guides for ALL live system exercises + apply metadata fixes.
 *
 * Usage:
 *   npx tsx scripts/generate-all-exercise-guides.ts [--guides-only] [--metadata-only] [--dry-run]
 *
 * Outputs:
 *   src/lib/generatedStructuredFormGuides.ts
 *   scripts/data/live-system-exercises.json
 *   supabase/migrations/030_fix_all_exercise_metadata.sql (when not guides-only)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildExerciseEducation } from '../src/lib/exerciseEducation/buildExerciseEducation.ts';
import { inferExerciseMetadata } from '../src/lib/exerciseEducation/inferExerciseMetadata.ts';
import type { ExerciseFormGuide } from '../src/lib/exerciseGuideTypes.ts';
import { STRUCTURED_EXERCISE_GUIDES } from '../src/lib/exerciseStructuredGuides.ts';
import {
    buildDatabaseUrl,
    loadRootEnv,
    projectRefFromUrl,
    runSqlViaManagementApi,
} from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const guidesOnly = process.argv.includes('--guides-only');
const metadataOnly = process.argv.includes('--metadata-only');

type LiveExercise = {
  id: string;
  slug: string;
  name: string;
  category: string;
  equipment: string;
  muscle_groups: string[] | null;
  secondary_muscles: string[] | null;
  exercise_type: string | null;
  metadata: Record<string, unknown> | null;
};

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTextArray(values: string[]): string {
  if (!values.length) return `array[]::text[]`;
  return `array[${values.map(sqlLiteral).join(', ')}]`;
}

async function queryJson(accessToken: string, projectRef: string, query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text);
}

function ensureGuideQuality(guide: ExerciseFormGuide, name: string): ExerciseFormGuide {
  const coachingCues =
    guide.coachingCues?.length && guide.coachingCues.length >= 2
      ? guide.coachingCues.slice(0, 5)
      : [
          `Control each rep of ${name}`,
          guide.muscleFocus?.split('.')[0] ?? 'Brace before you move',
          'Stop if form breaks',
        ];
  const commonMistakes =
    guide.commonMistakes?.length && guide.commonMistakes.length >= 2
      ? guide.commonMistakes.slice(0, 4)
      : [
          'Using momentum instead of muscle control',
          'Losing joint alignment under fatigue',
          'Holding your breath through the set',
        ];

  return {
    ...guide,
    summary: guide.summary ?? `${name} — follow setup and movement cues for safe, effective reps.`,
    equipment: guide.equipment ?? 'Use appropriate equipment for this movement.',
    setup: guide.setup ?? `Set up in a stable stance for ${name}. Brace your core before the first rep.`,
    startPosition: guide.startPosition ?? 'Begin each rep from a controlled, stacked starting position.',
    movement: guide.movement ?? `Perform ${name} through a full controlled range without rushing.`,
    endPosition: guide.endPosition ?? 'Finish the rep with control, then return to the start without dumping tension.',
    muscleFocus: guide.muscleFocus ?? 'Focus on the working muscles through the effort phase.',
    coachingCues,
    commonMistakes,
  };
}

function writeGuidesFile(bySlug: Record<string, ExerciseFormGuide>) {
  const entries = Object.keys(bySlug).sort();
  const ordered: Record<string, ExerciseFormGuide> = {};
  for (const slug of entries) ordered[slug] = bySlug[slug]!;

  const content = `/**
 * Auto-generated structured form guides for the live system exercise catalog.
 * Do not edit by hand — regenerate with:
 *   npx tsx scripts/generate-all-exercise-guides.ts --guides-only
 *
 * Hand-authored overrides in exerciseStructuredGuides.ts still win at resolve time.
 */
import type { ExerciseFormGuide } from '@/lib/exerciseGuideTypes';

export const GENERATED_STRUCTURED_FORM_GUIDES: Record<string, ExerciseFormGuide> = ${JSON.stringify(ordered, null, 2)};

export const GENERATED_STRUCTURED_FORM_GUIDE_COUNT = ${entries.length};
`;

  const outPath = path.join(root, 'src/lib/generatedStructuredFormGuides.ts');
  fs.writeFileSync(outPath, content);
  return { outPath, count: entries.length };
}

async function main() {
  console.log('=== Generate guides + metadata for all live system exercises ===\n');
  const env = loadRootEnv();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? buildDatabaseUrl(env);

  if (!accessToken || !projectRef) {
    console.error('Need SUPABASE_ACCESS_TOKEN + project ref in .env');
    process.exit(1);
  }

  const rows = (await queryJson(
    accessToken,
    projectRef,
    `
    select id, slug, name, category::text as category, equipment, muscle_groups, secondary_muscles,
           exercise_type::text as exercise_type, metadata
    from public.exercises
    where is_system = true and slug is not null
    order by name;
  `,
  )) as LiveExercise[];

  console.log(`Live system exercises: ${rows.length}`);
  const dataDir = path.join(root, 'scripts/data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'live-system-exercises.json'), JSON.stringify(rows, null, 2));

  if (!metadataOnly) {
    const bySlug: Record<string, ExerciseFormGuide> = {};
    let handAuthoredSkipped = 0;

    for (const row of rows) {
      if (STRUCTURED_EXERCISE_GUIDES[row.slug]) {
        handAuthoredSkipped += 1;
        // Still generate a full guide entry so coverage is 100% of catalog;
        // resolver prefers STRUCTURED_EXERCISE_GUIDES first.
      }

      const exercise = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category as never,
        equipment: row.equipment,
        muscleGroups: row.muscle_groups ?? [],
        secondaryMuscles: row.secondary_muscles ?? [],
        exerciseType: (row.exercise_type ?? 'strength') as never,
        isSystem: true,
        createdAt: new Date().toISOString(),
      };

      const guide = ensureGuideQuality(buildExerciseEducation(exercise, row.name), row.name);
      bySlug[row.slug] = {
        summary: guide.summary,
        equipment: guide.equipment,
        setup: guide.setup,
        startPosition: guide.startPosition,
        movement: guide.movement,
        endPosition: guide.endPosition,
        muscleFocus: guide.muscleFocus,
        coachingCues: guide.coachingCues,
        commonMistakes: guide.commonMistakes,
        musclesWorked: guide.musclesWorked,
        equipmentRequired: guide.equipmentRequired,
        feelShould: guide.feelShould,
        feelShouldNot: guide.feelShouldNot,
        regressions: guide.regressions,
        progressions: guide.progressions,
      };
    }

    if (!dryRun) {
      const written = writeGuidesFile(bySlug);
      console.log(`Wrote ${written.count} guides → ${path.relative(root, written.outPath)}`);
      console.log(`(hand-authored structured still overrides ${handAuthoredSkipped} of these at resolve time)`);
    } else {
      console.log(`[dry-run] would write ${Object.keys(bySlug).length} guides`);
    }
  }

  if (!guidesOnly) {
    const updates: string[] = [];
    let changed = 0;
    let unchanged = 0;

    for (const row of rows) {
      const inferred = inferExerciseMetadata({
        name: row.name,
        slug: row.slug,
        category: row.category as never,
        equipment: row.equipment,
        muscleGroups: row.muscle_groups ?? [],
        secondaryMuscles: row.secondary_muscles ?? [],
        exerciseType: (row.exercise_type ?? undefined) as never,
      });

      const currentMuscles = (row.muscle_groups ?? []).join('|');
      const nextMuscles = inferred.primaryMuscles.join('|');
      const currentSecondary = (row.secondary_muscles ?? []).join('|');
      const nextSecondary = inferred.secondaryMuscles.join('|');
      const needsUpdate =
        row.equipment !== inferred.equipment ||
        currentMuscles !== nextMuscles ||
        currentSecondary !== nextSecondary ||
        row.category !== inferred.movementCategory ||
        (row.exercise_type ?? 'strength') !== inferred.exerciseType;

      if (!needsUpdate) {
        unchanged += 1;
        continue;
      }
      changed += 1;

      const metaPatch = {
        requires: inferred.requires,
        movement_family: inferred.movementPattern,
        education_corrected_at: '2026-07-14',
        education_version: 3,
        education_patch: 'full-catalog',
      };

      updates.push(
        `update public.exercises set ` +
          `category = ${sqlLiteral(inferred.movementCategory)}::movement_category, ` +
          `equipment = ${sqlLiteral(inferred.equipment)}, ` +
          `muscle_groups = ${sqlTextArray(inferred.primaryMuscles)}, ` +
          `secondary_muscles = ${sqlTextArray(inferred.secondaryMuscles)}, ` +
          `exercise_type = ${sqlLiteral(inferred.exerciseType)}::exercise_type, ` +
          `metadata = coalesce(metadata, '{}'::jsonb) || ${sqlLiteral(JSON.stringify(metaPatch))}::jsonb, ` +
          `updated_at = now() ` +
          `where slug = ${sqlLiteral(row.slug)} and is_system = true;`,
      );
    }

    console.log(`Metadata: ${changed} to update, ${unchanged} already aligned`);

    const migrationPath = path.join(root, 'supabase/migrations/030_fix_all_exercise_metadata.sql');
    const migrationSql =
      `-- Full-catalog metadata alignment from name-based inference (education_version = 3).\n` +
      `-- Generated ${new Date().toISOString()} — ${changed} updates for ${rows.length} system exercises.\n\n` +
      updates.join('\n');
    if (!dryRun) fs.writeFileSync(migrationPath, migrationSql);

    if (!dryRun && updates.length) {
      const batchSize = 25;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize).join('\n');
        await runSqlViaManagementApi(batch, accessToken, projectRef);
        if ((i / batchSize + 1) % 5 === 0 || i + batchSize >= updates.length) {
          console.log(`  applied metadata batch ${Math.min(i + batchSize, updates.length)}/${updates.length}`);
        }
      }
    } else if (dryRun) {
      console.log(`[dry-run] would apply ${updates.length} metadata updates`);
    }

    if (!dryRun && dbUrl) {
      // optional no-op — management API path already applied
    }

    const verify = await queryJson(
      accessToken,
      projectRef,
      `
      select
        count(*) filter (where is_system)::int as system_count,
        count(*) filter (where is_system and metadata->>'education_version' = '3')::int as v3,
        count(*) filter (where is_system and metadata->>'education_patch' = 'full-catalog')::int as patched
      from public.exercises;
    `,
    );
    console.log('Post-metadata verify:', verify);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

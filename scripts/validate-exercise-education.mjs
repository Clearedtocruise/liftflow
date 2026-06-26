#!/usr/bin/env node
/**
 * Fail exercise catalog generation if metadata or education validation fails.
 * Used by migration generators and CI.
 */
import { detectMetadataMismatches, guidePatternForName, inferExerciseMetadata } from './lib/infer-exercise-metadata.mjs';
import { loadExerciseCatalog } from './lib/parse-exercise-catalog.mjs';

const SPOTLIGHT = [
  { slug: 'reverse-fly', name: 'Reverse Fly', forbiddenPattern: 'chest_fly', requiredPattern: 'rear_delt_fly' },
  { slug: 'dumbbell-thruster-intervals', name: 'Dumbbell Thruster Intervals', requiredPattern: 'thruster_or_cardio' },
  { slug: 'neck-extension-press', name: 'Neck Extension Press', forbiddenPattern: 'press', requiredPattern: 'neck_isolation' },
];

let fail = 0;

function record(ok, label, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail += 1;
}

function main() {
  console.log('=== Exercise Education Validation ===\n');
  const catalog = loadExerciseCatalog();
  const bySlug = new Map(catalog.map((r) => [r.slug, r]));

  record(catalog.length >= 900, 'Catalog size', `count=${catalog.length}`);

  for (const spot of SPOTLIGHT) {
    const row = bySlug.get(spot.slug);
    if (!row) {
      record(false, `Spotlight exercise present: ${spot.name}`, 'missing from catalog');
      continue;
    }

    const pattern = guidePatternForName(row.name);
    if (spot.requiredPattern) {
      record(pattern === spot.requiredPattern, `${spot.name} guide pattern`, `got ${pattern}`);
    }
    if (spot.forbiddenPattern) {
      record(pattern !== spot.forbiddenPattern, `${spot.name} avoids wrong pattern`, `got ${pattern}`);
    }

    const mismatches = detectMetadataMismatches(row);
    const muscleOk = !mismatches.some((m) => m.field === 'muscle_groups');
    const equipOk = !mismatches.some((m) => m.field === 'equipment');
    const typeOk = !mismatches.some((m) => m.field === 'exercise_type');
    record(muscleOk, `${spot.name} muscle map`);
    record(equipOk, `${spot.name} equipment map`);
    record(typeOk, `${spot.name} exercise type`);
  }

  let educationComplete = 0;
  for (const row of catalog) {
    const inferred = inferExerciseMetadata(row);
    if (inferred.primaryMuscles.length > 0) educationComplete += 1;
  }
  record(educationComplete === catalog.length, 'Runtime education completeness', `${educationComplete}/${catalog.length}`);

  const strictMetadata = process.argv.includes('--strict-metadata');
  if (strictMetadata) {
    let metadataErrors = 0;
    for (const row of catalog) {
      metadataErrors += detectMetadataMismatches(row).length;
    }
    record(metadataErrors === 0, 'Strict DB metadata (all rows)', `${metadataErrors} mismatches`);
  }

  console.log(`\nExercise education validation: ${fail === 0 ? 'PASS' : 'FAIL'} (${fail} failed)\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();

#!/usr/bin/env node
/**
 * Static checks for activity calorie estimation and exercise guide resolution wiring.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const checks = [
  {
    label: 'activityCalories MET formula',
    file: 'src/lib/activityCalories.ts',
    patterns: ['estimateActivityCalories', 'MET_BY_CARDIO_TYPE', 'equestrian: 5.5'],
  },
  {
    label: 'exercise guides avoid broken generated lookup',
    file: 'src/lib/exerciseFormGuides.ts',
    patterns: ['buildExerciseGuide', 'STRUCTURED_EXERCISE_GUIDES', 'buildExerciseEducation'],
    forbidden: ['GENERATED_EXERCISE_FORM_GUIDES'],
  },
  {
    label: 'back extension pattern in builder',
    file: 'src/lib/exerciseGuideBuilder.ts',
    patterns: ["['back extension', 'hyperextension', 'reverse hyper']", 'spinal erectors'],
  },
  {
    label: 'Exercise guide feel-like section',
    file: 'src/components/workout/execution/ExerciseGuideSheet.tsx',
    patterns: ['What it should feel like', 'feelShould', 'feelShouldNot', 'ExerciseMovementMedia'],
  },
  {
    label: 'Exercise education inference',
    file: 'src/lib/exerciseEducation/inferExerciseMetadata.ts',
    patterns: ['reverse fly', 'neck', 'thruster', 'detectMetadataMismatches'],
  },
  {
    label: 'cardioService startedAt timestamps',
    file: 'src/services/cardioService.ts',
    patterns: ['startedAt?:', 'payload.startedAt', 'ended_at: endedAt'],
  },
  {
    label: 'StartSessionPayload exercisePlan type',
    file: 'src/types/workout.ts',
    patterns: ['exercisePlan?:'],
  },
];

let fail = 0;

for (const { label, file, patterns, forbidden = [] } of checks) {
  const src = read(file);
  const missing = patterns.filter((p) => !src.includes(p));
  const blocked = forbidden.filter((p) => src.includes(p));
  if (missing.length === 0 && blocked.length === 0) {
    console.log(`  PASS — ${label}`);
  } else {
    const parts = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
    if (blocked.length > 0) parts.push(`forbidden: ${blocked.join(', ')}`);
    console.log(`  FAIL — ${label} — ${parts.join('; ')}`);
    fail += 1;
  }
}

if (fail > 0) {
  console.error(`\nSession feature validation failed (${fail} check(s)).`);
  process.exit(1);
}

console.log(`\nSession features: PASS (${checks.length}/${checks.length})`);

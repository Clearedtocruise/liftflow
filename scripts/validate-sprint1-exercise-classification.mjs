#!/usr/bin/env node
/**
 * Sprint 1 — Exercise classification engine validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 1 Exercise Classification Engine ===\n');

for (const file of [
  'src/types/exerciseClassification.ts',
  'src/constants/exerciseDatabase.ts',
  'src/lib/exerciseClassification.ts',
  'backend/src/lib/exerciseClassification.ts',
  'supabase/migrations/020_exercise_classification.sql',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const catalog = read('src/constants/exerciseDatabase.ts');
const engine = read('src/lib/exerciseClassification.ts');
const migration = read('supabase/migrations/020_exercise_classification.sql');
const schema = read('supabase/schema.sql');

/** Every seeding source, since later migrations added the leg, core and imported catalogs. */
const allMigrations = fs
  .readdirSync(path.join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => read(`supabase/migrations/${file}`))
  .join('\n')
  .concat(schema);

record('Schema defines exercise_type enum', schema.includes("create type public.exercise_type"));
record('Schema stores exercise_type on exercises', schema.includes('exercise_type public.exercise_type'));
record('Migration creates exercise_type enum', migration.includes("create type public.exercise_type"));
record('Migration backfills strength slugs', migration.includes("'bench-press'"));
record('Migration backfills bodyweight slugs', migration.includes("'pull-up'"));
record('Migration backfills timed slugs', migration.includes("'plank'"));
record('Migration seeds cardio exercises', migration.includes("'running'"));

for (const token of ['classifyExercise', 'resolveExerciseType', 'catalogExerciseBySlug', 'SYSTEM_EXERCISE_CATALOG']) {
  record(`Classification engine: ${token}`, engine.includes(token) || catalog.includes(token));
}

const slugMatches = [...catalog.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
const uniqueSlugs = new Set(slugMatches);
record('Catalog has unique slugs', uniqueSlugs.size === slugMatches.length, `${slugMatches.length} exercises`);

const typeCounts = { strength: 0, bodyweight: 0, timed: 0, cardio: 0 };
for (const match of catalog.matchAll(/exerciseType: '(strength|bodyweight|timed|cardio)'/g)) {
  typeCounts[match[1]] += 1;
}

console.log('\nExercise counts by category (catalog):');
for (const [type, count] of Object.entries(typeCounts)) {
  console.log(`  ${type}: ${count}`);
  record(`Catalog count > 0: ${type}`, count > 0, String(count));
}

// The catalog started at 37 and is expected to grow; pinning the exact count only ever failed.
record('Catalog has at least the Sprint 1 exercises', slugMatches.length >= 37, String(slugMatches.length));

// Slugs are seeded across several migrations (leg / core / 1000-exercise import), not just this
// one, so a slug missing everywhere is the real failure — an exercise the app offers but the
// database has never heard of.
const missingSlugs = slugMatches.filter((slug) => !allMigrations.includes(`'${slug}'`));
record(
  'Every catalog slug is seeded by some migration',
  missingSlugs.length === 0,
  missingSlugs.length ? missingSlugs.join(', ') : 'all seeded',
);

for (const slug of ['bench-press', 'pull-up', 'plank', 'running']) {
  record(`Migration covers ${slug}`, migration.includes(`'${slug}'`));
}

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testRun = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/exerciseClassification.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (exerciseClassification.test.ts)',
  testRun.status === 0,
  testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 160),
);

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

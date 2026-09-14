import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const INSERT_PATTERN =
  /values \('([^']+)', '([^']+)', '([^']+)', '([^']+)', array\[([^\]]+)\], true, '([^']+)', '(\{.*?\})'::jsonb\)/g;

export function parseExerciseCatalogFromSql(sqlText) {
  const rows = [];
  const normalized = sqlText.replace(/\n\s+/g, ' ');
  let match;
  while ((match = INSERT_PATTERN.exec(normalized)) !== null) {
    const [, name, slug, category, equipment, musclesRaw, exerciseType, metaRaw] = match;
    const muscleGroups = musclesRaw
      .replace(/'/g, '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    let metadata = {};
    try {
      metadata = JSON.parse(metaRaw.replace(/''/g, "'"));
    } catch {
      metadata = {};
    }
    rows.push({
      name,
      slug,
      category,
      equipment,
      muscleGroups,
      muscle: muscleGroups[0] ?? '',
      exerciseType,
      requires: metadata.requires ?? [],
      movementFamily: metadata.movement_family ?? '',
      sourceExerciseId: metadata.source_exercise_id ?? '',
    });
  }
  return rows;
}

export function loadExerciseCatalog() {
  const files = [
    path.join(root, 'supabase/migrations/002_seed_and_storage.sql'),
    path.join(root, 'supabase/migrations/003_training_profile.sql'),
    path.join(root, 'supabase/migrations/020_exercise_classification.sql'),
    path.join(root, 'supabase/migrations/022_expand_leg_exercise_catalog.sql'),
    path.join(root, 'supabase/migrations/023_expand_core_exercise_catalog.sql'),
    path.join(root, 'supabase/migrations/024_import_1000_exercise_catalog.sql'),
    path.join(root, 'supabase/migrations/025_fix_exercise_equipment_requires.sql'),
  ];

  const bySlug = new Map();
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const row of parseExerciseCatalogFromSql(text)) {
      bySlug.set(row.slug, row);
    }
  }
  return [...bySlug.values()];
}

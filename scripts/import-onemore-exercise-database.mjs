#!/usr/bin/env node
/**
 * Parse oneMore_1000_Exercise_Database.numbers and validate for LiftFlow import.
 *
 * Usage:
 *   node --import tsx scripts/import-onemore-exercise-database.mjs [path/to/file.numbers]
 *
 * Requires: pip install numbers-parser
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeOneMoreCatalog } from '../backend/src/lib/exerciseDatabaseImport.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPath = path.join(process.env.HOME ?? '', 'Desktop/oneMore_1000_Exercise_Database.numbers');

const args = process.argv.slice(2);
const numbersPath = args.find((arg) => arg.endsWith('.numbers')) ?? defaultPath;

if (!fs.existsSync(numbersPath)) {
  console.error(`Numbers file not found: ${numbersPath}`);
  process.exit(1);
}

const python = `
from numbers_parser import Document
import json, sys

doc = Document(sys.argv[1])
table = doc.sheets[0].tables[0]
rows = []
for r in range(1, table.num_rows):
    rows.append({
        "exercise_id": table.cell(r, 0).value,
        "exercise_name": table.cell(r, 1).value,
        "primary_muscle": table.cell(r, 2).value,
        "secondary_muscle": table.cell(r, 3).value,
        "equipment_code": table.cell(r, 4).value,
        "difficulty": table.cell(r, 5).value,
        "movement_pattern": table.cell(r, 6).value,
        "description": table.cell(r, 7).value,
        "home_gym_compatible": table.cell(r, 8).value,
        "ai_replacement_category": table.cell(r, 9).value,
    })
print(json.dumps(rows))
`;

const parsed = spawnSync('python3', ['-c', python, numbersPath], { encoding: 'utf8' });
if (parsed.status !== 0) {
  console.error(parsed.stderr || 'Failed to parse Numbers file. Install: pip3 install numbers-parser');
  process.exit(1);
}

const rows = JSON.parse(parsed.stdout.trim());
const analysis = analyzeOneMoreCatalog(rows);

console.log('oneMore Exercise Database — import analysis');
console.log('==========================================');
console.log(`Source: ${numbersPath}`);
console.log(`Total rows: ${analysis.totalRows}`);
console.log(`Placeholder names (Variation N): ${analysis.placeholderCount}`);
console.log(`Importable real names: ${analysis.importableCount}`);
console.log(`Unique slugs: ${analysis.uniqueSlugs}`);
console.log(`Duplicate slug groups: ${analysis.duplicateSlugCount}`);
console.log(`Muscle codes: ${analysis.muscleCodes.join(', ')}`);
console.log(`Equipment codes: ${analysis.equipmentCodes.join(', ')}`);
console.log(`Movement patterns: ${analysis.movementPatterns.join(', ')}`);

if (analysis.samplePlaceholderNames.length) {
  console.log('\nSample placeholder names:');
  for (const name of analysis.samplePlaceholderNames) console.log(`  - ${name}`);
}

if (analysis.importableCount === 0) {
  console.log('\nRESULT: NOT READY FOR PRODUCTION IMPORT');
  console.log('Every row uses generated names like "Chest Push Variation 1".');
  console.log('Replace exercise_name with real lifts (Hammer Curl, Lat Pulldown, etc.) before importing.');
  process.exit(2);
}

console.log('\nSample importable names:');
for (const name of analysis.sampleImportableNames) console.log(`  - ${name}`);
console.log('\nRESULT: READY TO IMPORT');
process.exit(0);

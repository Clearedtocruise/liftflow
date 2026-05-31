#!/usr/bin/env node
/**
 * Cross-feature integration — recovery, nutrition, coach, recommendations share context.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Intelligence Integration Verification ===\n');

const loader = read('backend/src/lib/loadConversationalCoachContext.ts');
const sources = [
  'loadRecoveryIntelligence',
  'loadNutritionIntelligence',
  'loadWorkoutRecommendations',
  'progress_photos',
  'loadCoachMemory',
];

let pass = 0;
for (const src of sources) {
  if (loader.includes(src)) {
    console.log(`  ✓ Coach context uses ${src}`);
    pass += 1;
  } else {
    console.log(`  ✗ Coach context missing ${src}`);
  }
}

const coachEngine = read('backend/src/lib/conversationalCoachEngine.ts');
if (coachEngine.includes('converseWithCoach') && coachEngine.includes('referencesUsed')) {
  console.log('  ✓ Conversational coach engine');
  pass += 1;
} else console.log('  ✗ Conversational coach engine');

const local = spawnSync('node', ['scripts/test-local-api-routes.mjs'], { cwd: root, encoding: 'utf8', timeout: 120000 });
process.stdout.write(local.stdout ?? '');
if (local.stderr) process.stderr.write(local.stderr);
if (local.status === 0) {
  console.log('\n  ✓ Local API cross-route E2E');
  pass += 1;
} else {
  console.log('\n  ✗ Local API cross-route E2E');
}

const total = sources.length + 2;
console.log(`\n=== Integration Summary: ${pass}/${total} PASS ===`);
process.exit(pass === total ? 0 : 1);

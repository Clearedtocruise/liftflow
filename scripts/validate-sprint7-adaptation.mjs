#!/usr/bin/env node
/**
 * Sprint 7 — Equipment & preference adaptation validation
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

console.log('=== Sprint 7 Equipment & Preference Adaptation ===\n');

for (const file of [
  'backend/src/lib/equipmentSubstitutionEngine.ts',
  'backend/src/lib/nutritionPreferenceEngine.ts',
  'backend/src/lib/preferenceAdaptation.ts',
  'docs/SPRINT7_ADAPTATION_REPORT.md',
  'src/services/adaptationService.ts',
  'src/components/adaptation/AdaptationNotice.tsx',
  'src/app/(features)/nutrition-preferences.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const engine = read('backend/src/lib/equipmentSubstitutionEngine.ts');
const nutrition = read('backend/src/lib/nutritionPreferenceEngine.ts');
const adapt = read('backend/src/lib/preferenceAdaptation.ts');
const equipmentUi = read('src/app/(features)/equipment.tsx');

for (const token of ['NAMED_SUBSTITUTIONS', 'cable fly', 'lat pulldown', 'applyEquipmentSubstitutionsToExercises']) {
  record(`Equipment engine: ${token}`, engine.includes(token));
}

record('Nutrition engine: adaptMealName', nutrition.includes('adaptMealName'));
record('Nutrition engine: RESTRICTION_REPLACEMENTS', nutrition.includes('RESTRICTION_REPLACEMENTS'));
record('Preference adaptation orchestrator', adapt.includes('adaptToPreferenceChanges'));
record('API route /preferences/adapt', read('backend/src/routes/training.ts').includes('/preferences/adapt'));
record('Equipment save triggers adaptation', equipmentUi.includes("applyChanges(user.id, 'equipment')"));
record('Settings links nutrition preferences', read('src/app/(tabs)/settings.tsx').includes('nutrition-preferences'));
record('Adaptation notice component', read('src/components/adaptation/AdaptationNotice.tsx').includes('notificationTitle'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
for (const testFile of ['equipmentSubstitutionEngine.test.ts', 'nutritionPreferenceEngine.test.ts']) {
  const testRun = fs.existsSync(backendTsx)
    ? spawnSync(process.execPath, [backendTsx, `src/lib/${testFile}`], {
        cwd: path.join(root, 'backend'),
        encoding: 'utf8',
      })
    : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
  record(
    `Unit tests (${testFile})`,
    testRun.status === 0,
    testRun.status === 0 ? 'PASS' : (testRun.stderr || testRun.stdout || '').trim().slice(0, 120),
  );
}

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);

#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('=== Sprint 5 Activity Logging ===\n');

const active = fs.readFileSync(path.join(root, 'src/components/workout/execution/ActiveWorkoutScreen.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/app/(tabs)/dashboard.tsx'), 'utf8');

for (const file of [
  'src/services/cardioService.ts',
  'src/constants/activityOptions.ts',
  'src/app/(features)/log-activity.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

record('Add set in active workout', active.includes('+ Add Set') && active.includes('bonusSets'));
record('Delete set in active workout', active.includes('Delete Last Set') && active.includes('handleDeleteSet'));
record('Add exercise during workout', active.includes('ExercisePickerModal') && active.includes('+ Add Exercise'));
record('Cardio persistence service', fs.readFileSync(path.join(root, 'src/services/cardioService.ts'), 'utf8').includes('cardio_sessions'));
record('Sports catalog', fs.readFileSync(path.join(root, 'src/constants/activityOptions.ts'), 'utf8').includes('SPORTS_ACTIVITIES'));
record('Home + Activity button', dashboard.includes('handleLogActivity') && fs.readFileSync(path.join(root, 'src/components/dashboard/HomeNextUpCard.tsx'), 'utf8').includes('+ Activity'));
record('Recovery uses cardio sessions', fs.readFileSync(path.join(root, 'backend/src/lib/loadRecoveryIntelligence.ts'), 'utf8').includes('cardio_sessions'));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} failed.`}`);
process.exit(failed.length === 0 ? 0 : 1);

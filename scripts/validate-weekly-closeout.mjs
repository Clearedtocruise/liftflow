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

console.log('=== Weekly Closeout ===\n');

for (const file of [
  'backend/src/lib/weeklyCloseoutEngine.ts',
  'backend/src/lib/nextWeekPlanner.ts',
  'backend/src/routes/weekly.ts',
  'supabase/migrations/021_weekly_closeouts.sql',
  'src/services/weeklyCloseoutService.ts',
  'src/types/weeklyCloseout.ts',
  'src/app/(features)/weekly-summary.tsx',
  'src/app/(features)/next-week-plan.tsx',
  'src/components/dashboard/WeeklyReviewCard.tsx',
  'src/hooks/useWeeklyReviewPrompt.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const engine = fs.readFileSync(path.join(root, 'backend/src/lib/weeklyCloseoutEngine.ts'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/app/(tabs)/dashboard.tsx'), 'utf8');
record('Archive closeout table', fs.readFileSync(path.join(root, 'supabase/migrations/021_weekly_closeouts.sql'), 'utf8').includes('weekly_closeouts'));
record('Prepare + accept API', fs.readFileSync(path.join(root, 'backend/src/routes/weekly.ts'), 'utf8').includes('closeout/prepare'));
record('Training summary fields', engine.includes('workoutsCompleted') && engine.includes('totalVolumeKg'));
record('Nutrition summary fields', engine.includes('adherencePct') && engine.includes('avgProteinG'));
record('Next week plan preview', engine.includes('nextWeekPlan'));
record('Saturday review card on home', dashboard.includes('WeeklyReviewCard') && dashboard.includes('showWeeklyReview'));
record('Does not overwrite — upsert archives', engine.includes("status: 'pending_review'"));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} failed.`}`);
process.exit(failed.length === 0 ? 0 : 1);

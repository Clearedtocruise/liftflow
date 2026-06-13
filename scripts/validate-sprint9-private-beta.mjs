#!/usr/bin/env node
/**
 * Sprint 9 — Private Beta Program validation
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

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runValidator(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000, shell: false });
  const m = `${r.stdout ?? ''}${r.stderr ?? ''}`.match(/(\d+)\/(\d+) checks/);
  return { ok: r.status === 0, pass: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : 0 };
}

console.log('=== Sprint 9 Private Beta Program ===\n');

console.log('--- Preconditions ---');
const sprint87 = runValidator('scripts/validate-sprint87-closed-beta.mjs');
record('Sprint 8.7 regression (informational)', sprint87.ok, `${sprint87.pass}/${sprint87.total}`);

console.log('\n--- Sprint 9 deliverables ---');
for (const file of [
  'docs/SPRINT9_PRIVATE_BETA_PLAN.md',
  'docs/SPRINT9_BETA_TESTING_CHECKLIST.md',
  'docs/SPRINT9_FEEDBACK_TRIAGE.md',
  'docs/SPRINT9_FIX_ROADMAP.md',
  'docs/SPRINT9_TESTER_ROSTER.md',
  'supabase/migrations/019_sprint9_feedback_taxonomy.sql',
  'scripts/apply-migration-019.mjs',
]) {
  record(`File exists: ${file}`, exists(file));
}

const plan = read('docs/SPRINT9_PRIVATE_BETA_PLAN.md');
const checklist = read('docs/SPRINT9_BETA_TESTING_CHECKLIST.md');
const triage = read('docs/SPRINT9_FEEDBACK_TRIAGE.md');
const feedbackLib = read('backend/src/lib/feedback.ts');
const feedbackRoutes = read('backend/src/routes/feedback.ts');
const feedbackUi = read('src/app/(features)/send-feedback.tsx');
const settings = read('src/app/(tabs)/settings.tsx');

for (const token of ['P1 — Beginner', 'P4 — Home gym', 'P5 — Commercial', '10+ testers']) {
  record(`Beta plan: ${token}`, plan.includes(token));
}
record('Beta plan: issue categorization', plan.includes('issue_category') || plan.includes('byCategory'));

record('Checklist: persona paths', checklist.includes('P1 — Beginner') && checklist.includes('P5 — Commercial'));
record('Triage: category guide', triage.includes('missing_feature') && triage.includes('confusion'));
record('Roster: 12 tester slots', read('docs/SPRINT9_TESTER_ROSTER.md').split('| 12 |').length >= 2);

record('Feedback: confusion type in UI', feedbackUi.includes("'confusion'"));
record('Feedback: area picker', feedbackUi.includes('AREAS'));
record('Feedback: missing feature toggle', feedbackUi.includes('missingFeature'));
record('Settings: confusion entry point', settings.includes('type=confusion'));
record('Backend: inferIssueCategory', feedbackLib.includes('inferIssueCategory'));
record('Backend: byCategory summary', feedbackLib.includes('byCategory'));
record('API: feedback list route', feedbackRoutes.includes("'/list'"));
record('API: feedback status patch', feedbackRoutes.includes('/:id/status'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const feedbackTest = fs.existsSync(backendTsx)
  ? spawnSync(process.execPath, [backendTsx, 'src/lib/feedback.test.ts'], {
      cwd: path.join(root, 'backend'),
      encoding: 'utf8',
    })
  : { status: 1, stdout: '', stderr: 'tsx not installed in backend' };
record(
  'Unit tests (feedback.test.ts)',
  feedbackTest.status === 0,
  feedbackTest.status === 0 ? 'PASS' : (feedbackTest.stderr || feedbackTest.stdout || '').trim().slice(0, 120),
);

console.log('\n--- Build ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

const pass = checks.filter((c) => c.pass).length;
const required = checks.filter((c) => !c.name.includes('informational'));
const requiredPass = required.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks (${requiredPass}/${required.length} required)`);

if (requiredPass !== required.length) process.exit(1);

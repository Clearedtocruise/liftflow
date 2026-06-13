#!/usr/bin/env node
/**
 * Sprint 11 — Transformation Engine Redesign validation
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

console.log('=== Sprint 11 Transformation Redesign ===\n');

for (const file of [
  'docs/SPRINT11_TRANSFORMATION_REDESIGN.md',
  'src/lib/transformation/transformationStory.ts',
  'src/lib/transformation/transformationStory.test.ts',
  'src/components/body/TransformationStoryHero.tsx',
  'src/components/body/CoachProjectionCard.tsx',
  'src/components/body/TransformationProgressTimeline.tsx',
  'src/components/body/CoachInsightsPanel.tsx',
  'src/components/body/TransformationMilestones.tsx',
  'src/components/body/PhotoProgressGuide.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const progress = read('src/app/(tabs)/progress.tsx');
const story = read('src/lib/transformation/transformationStory.ts');
const bodyComp = read('src/components/body/BodyCompositionSummary.tsx');

record('Progress: story-first header', progress.includes('Your Transformation'));
record('Progress: TransformationStoryHero', progress.includes('TransformationStoryHero'));
record('Progress: CoachProjectionCard', progress.includes('CoachProjectionCard'));
record('Progress: timeline component', progress.includes('TransformationProgressTimeline'));
record('Progress: milestones', progress.includes('TransformationMilestones'));
record('Progress: photo guide', progress.includes('PhotoProgressGuide'));
record('Progress: coach insights', progress.includes('CoachInsightsPanel'));
record('Story: milestones 20-10', story.includes('BODY_FAT_MILESTONES') && story.includes('20'));
record('Story: schedule status', story.includes('Ahead of schedule'));
record('Story: coach insights', story.includes('buildCoachInsights'));
record('Body comp: unified mass units', bodyComp.includes('formatMassFromKg'));

const backendTsx = path.join(root, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const rootTsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tsx = fs.existsSync(rootTsx) ? rootTsx : backendTsx;
const testRun = fs.existsSync(tsx)
  ? spawnSync(process.execPath, [tsx, 'src/lib/transformation/transformationStory.test.ts'], {
      cwd: root,
      encoding: 'utf8',
    })
  : { status: 1, stderr: 'tsx not found' };
record(
  'Unit tests (transformationStory.test.ts)',
  testRun.status === 0,
  testRun.status === 0 ? 'PASS' : String(testRun.stderr || testRun.stdout).slice(0, 120),
);

const sprint82 = spawnSync('node', ['scripts/validate-sprint82-transformation.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const m = `${sprint82.stdout ?? ''}`.match(/(\d+)\/(\d+)/);
record('Sprint 8.2 regression', sprint82.status === 0, m ? m[0] : 'check output');

const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

const pass = checks.filter((c) => c.pass).length;
console.log(`\nSummary: ${pass}/${checks.length} checks`);
if (pass !== checks.length) process.exit(1);

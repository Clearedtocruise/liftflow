#!/usr/bin/env node
/**
 * Sprint 8.8 — validate ONE MORE public branding.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const USER_FACING_GLOBS = [
  'app.config.ts',
  'src/app',
  'src/components',
  'src/constants/legalContent.ts',
  'src/constants/subscription.ts',
  'src/constants/theme.ts',
  'src/constants/whyLiftFlow.ts',
  'src/constants/features.ts',
  'src/services/notificationService.ts',
  'src/services/socialShareService.ts',
  'public/legal',
  'backend/src/lib/authPages.ts',
  'backend/src/routes/platform.ts',
  'backend/src/routes/legal.ts',
  'docs/store',
];

const ALLOWED_PATTERNS = [
  /LiftFlowColors/,
  /LiftFlowWordmark/,
  /LiftFlowLogo/,
  /LiftFlowInsight/,
  /whyLiftFlow/,
  /WHY_LIFTFLOW/,
  /WhyLiftFlow/,
  /useLiftFlowTheme/,
  /liftflow\.app/,
  /liftflow-api/,
  /com\.liftflow/,
  /liftflow_premium/,
  /liftflow_basic/,
  /liftflow@\d/,
  /liftflow-api@/,
  /support@liftflow/,
  /@liftflow/,
  /why-liftflow/,
  /HeroImages\.whyLiftFlow/,
  /liftflow-icon/,
  /owner: 'liftflow1'/,
  /slug: 'liftflow'/,
  /scheme: 'liftflow'/,
  /liftflow:\/\//,
  /LiftFlow Sprint/,
  /Approved LiftFlow mark/,
  /LiftFlow domains/,
  /LiftFlow backend/,
  /LiftFlow workout queue/,
  /Hey LiftFlow/,
  /LiftFlow Sentry test/,
  /LiftFlow runtime error/,
  /LiftFlow Founder/,
  /LiftFlow Export/,
  /LiftFlow API listening/,
  /LiftFlow Workout Export/,
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.expo'].includes(entry.name)) continue;
      walk(fp, acc);
    } else if (/\.(tsx?|jsx?|html|md|json)$/.test(entry.name)) {
      acc.push(fp);
    }
  }
  return acc;
}

function collectFiles() {
  const files = new Set();
  for (const rel of USER_FACING_GLOBS) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) continue;
    if (fs.statSync(fp).isDirectory()) walk(fp).forEach((f) => files.add(f));
    else files.add(fp);
  }
  return [...files];
}

function isAllowed(line) {
  return ALLOWED_PATTERNS.some((p) => p.test(line));
}

function main() {
  console.log('=== One More Branding Validation ===\n');
  const issues = [];
  let pass = 0;

  const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
  const nameOk = appConfig.includes("name: 'ONE MORE'");
  console.log(`  ${nameOk ? 'PASS' : 'FAIL'} — app.config.ts display name is ONE MORE`);
  if (nameOk) pass += 1;
  else issues.push('app.config.ts name should be ONE MORE');

  const storeDoc = fs.readFileSync(path.join(root, 'docs/store/APP_STORE_LISTING.md'), 'utf8');
  const ascOk = storeDoc.includes('One More Fitness');
  console.log(`  ${ascOk ? 'PASS' : 'FAIL'} — App Store listing name is One More Fitness`);
  if (ascOk) pass += 1;
  else issues.push('docs/store/APP_STORE_LISTING.md missing One More Fitness');

  const sub = fs.readFileSync(path.join(root, 'src/constants/subscription.ts'), 'utf8');
  const planOk = sub.includes("planName: 'ONE MORE Pro'");
  console.log(`  ${planOk ? 'PASS' : 'FAIL'} — subscription planName is ONE MORE Pro`);
  if (planOk) pass += 1;

  const brand = fs.readFileSync(path.join(root, 'src/constants/theme.ts'), 'utf8');
  const brandOk = brand.includes("name: 'ONE MORE'") && brand.includes("appStoreName: 'One More Fitness'");
  console.log(`  ${brandOk ? 'PASS' : 'FAIL'} — Brand constants configured`);
  if (brandOk) pass += 1;

  const legacyHits = [];
  for (const fp of collectFiles()) {
    const rel = path.relative(root, fp);
    const lines = fs.readFileSync(fp, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/LiftFlow|RepForge/i.test(line)) return;
      if (isAllowed(line)) return;
      legacyHits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }

  const noRepForge = !walk(root).some((fp) => {
    const rel = path.relative(root, fp);
    if (rel === 'ONE_MORE_BRANDING_AUDIT.md') return false;
    if (rel.startsWith('scripts/') && /validate-branding|generate-branding-audit/.test(rel)) return false;
    const t = fs.readFileSync(fp, 'utf8');
    return /RepForge/i.test(t);
  });
  console.log(`  ${noRepForge ? 'PASS' : 'FAIL'} — no RepForge references in repo`);
  if (noRepForge) pass += 1;

  if (legacyHits.length === 0) {
    console.log('  PASS — no disallowed LiftFlow user-facing strings');
    pass += 1;
  } else {
    console.log(`  FAIL — ${legacyHits.length} disallowed LiftFlow reference(s):`);
    legacyHits.slice(0, 15).forEach((h) => console.log(`    ${h}`));
    if (legacyHits.length > 15) console.log(`    … and ${legacyHits.length - 15} more`);
    issues.push(...legacyHits);
  }

  console.log(`\n=== ${issues.length === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + (legacyHits.length ? 0 : 0) + (issues.length > legacyHits.length ? issues.length - legacyHits.length : 0)} core checks ===`);
  if (legacyHits.length) {
    console.log(`\nRemaining references to review: ${legacyHits.length}`);
  }
  process.exit(issues.length === 0 && legacyHits.length === 0 ? 0 : legacyHits.length ? 1 : 0);
}

main();

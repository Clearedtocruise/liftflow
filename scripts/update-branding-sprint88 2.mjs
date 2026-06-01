#!/usr/bin/env node
/**
 * Sprint 8.8 — ONE MORE user-facing branding update.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const TARGET_PATHS = [
  'src',
  'public',
  'backend/src/lib/authPages.ts',
  'backend/src/lib/pdfExport.ts',
  'backend/src/routes/legal.ts',
  'backend/src/middleware/requireProSubscription.ts',
  'backend/src/lib/aiCoach.ts',
  'backend/src/lib/conversationalCoachEngine.ts',
  'backend/src/routes/platform.ts',
  'docs/store',
];

const PROTECTED_PATTERNS = [
  /liftflow:\/\//g,
  /com\.liftflow\.app/g,
  /liftflow-api/g,
  /support@liftflow\.app/g,
  /liftflow-icon/g,
  /liftflow_premium/g,
  /whyLiftFlow/g,
  /WHY_LIFTFLOW/g,
  /WhyLiftFlow/g,
  /useLiftFlowTheme/g,
  /LiftFlowColors/g,
  /LiftFlowWordmark/g,
  /LiftFlowLogo/g,
  /LiftFlowInsight/g,
  /LiftFlowColor/g,
  /LiftFlow Sprint/g,
  /Approved LiftFlow mark/g,
  /slug: 'liftflow'/g,
  /scheme: 'liftflow'/g,
  /owner: 'liftflow1'/g,
  /liftflow\.app/g,
  /@liftflow/g,
];

const CORRUPTION_FIXES = [
  ['One MoreColors', 'LiftFlowColors'],
  ['One MoreLogo', 'LiftFlowLogo'],
  ['One MoreInsight', 'LiftFlowInsight'],
  ['One MoreWordmark', 'LiftFlowWordmark'],
  ['WhyOne MoreSlide', 'WhyLiftFlowSlide'],
  ['HeroImages.whyOne More', 'HeroImages.whyLiftFlow'],
  ['@/components/brand/One MoreLogo', '@/components/brand/LiftFlowLogo'],
];

const modified = new Set();

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
  for (const rel of TARGET_PATHS) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) continue;
    if (fs.statSync(fp).isDirectory()) walk(fp).forEach((f) => files.add(f));
    else files.add(fp);
  }
  return [...files];
}

function protect(content) {
  const tokens = [];
  let idx = 0;
  let out = content;
  for (const pattern of PROTECTED_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const token = `__PROTECT_${idx++}__`;
      tokens.push({ token, match });
      return token;
    });
  }
  return { out, tokens };
}

function restore(content, tokens) {
  let out = content;
  for (const { token, match } of tokens) {
    out = out.split(token).join(match);
  }
  return out;
}

function replaceUserFacing(content) {
  let { out, tokens } = protect(content);
  out = out.replace(/LiftFlow/g, 'ONE MORE');
  out = out.replace(/One More/g, 'ONE MORE');
  return restore(out, tokens);
}

function writeIfChanged(fp, content) {
  const prev = fs.readFileSync(fp, 'utf8');
  if (prev !== content) {
    fs.writeFileSync(fp, content, 'utf8');
    modified.add(path.relative(root, fp));
  }
}

function fixCorruptionGlobally() {
  const exts = /\.(tsx?|jsx?|html|md|json)$/;
  for (const rel of ['src', 'backend/src', 'public', 'docs/store']) {
    const base = path.join(root, rel);
    if (!fs.existsSync(base)) continue;
    const files = fs.statSync(base).isDirectory() ? walk(base) : [base];
    for (const fp of files) {
      if (!exts.test(fp)) continue;
      let content = fs.readFileSync(fp, 'utf8');
      let next = content;
      for (const [from, to] of CORRUPTION_FIXES) {
        next = next.split(from).join(to);
      }
      writeIfChanged(fp, next);
    }
  }
}

function bulkReplaceUserFacing() {
  const skip = new Set([
    'src/constants/theme.ts',
    'src/constants/subscription.ts',
    'src/constants/legalContent.ts',
    'app.config.ts',
  ]);
  for (const fp of collectFiles()) {
    const rel = path.relative(root, fp);
    if (skip.has(rel)) continue;
    const content = fs.readFileSync(fp, 'utf8');
    writeIfChanged(fp, replaceUserFacing(content));
  }
}

function updateTheme() {
  const fp = path.join(root, 'src/constants/theme.ts');
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(
    /export const Brand = \{[\s\S]*?\} as const;/,
    `export const Brand = {
  /** In-app display name */
  name: 'ONE MORE',
  /** App Store Connect listing name */
  appStoreName: 'One More Fitness',
  companyName: 'One More Fitness',
  planName: 'ONE MORE Pro',
  premiumName: 'ONE MORE Premium',
  coachName: 'ONE MORE Coach',
  taglinePrimary: 'Only One.',
  taglineSecondary: 'Only One.',
  heroHeadline: 'YOUR TRANSFORMATION STARTS WITH ONE MORE.',
} as const;`,
  );
  writeIfChanged(fp, content);
}

function updateAppConfig() {
  const fp = path.join(root, 'app.config.ts');
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/name: 'One More'/, "name: 'ONE MORE'");
  content = content.replace(/One More /g, 'ONE MORE ');
  content = content.replace(/One More\./g, 'ONE MORE.');
  content = content.replace(/One More…/g, 'ONE MORE…');
  writeIfChanged(fp, content);
}

function updateSubscription() {
  const fp = path.join(root, 'src/constants/subscription.ts');
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/planName: 'One More Pro'/, "planName: 'ONE MORE Pro'");
  writeIfChanged(fp, content);
}

function updateLegalContent() {
  const fp = path.join(root, 'src/constants/legalContent.ts');
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/One More/g, 'ONE MORE');
  content = content.replace(/LiftFlow/g, 'ONE MORE');
  // Restore protected email/domain tokens broken by LiftFlow replace
  content = content.replace(/support@ONE MORE\.app/g, 'support@liftflow.app');
  content = content.replace(/ONE MORE\.app/g, 'liftflow.app');
  writeIfChanged(fp, content);
}

function main() {
  console.log('Sprint 8.8 — ONE MORE branding update\n');
  fixCorruptionGlobally();
  bulkReplaceUserFacing();
  updateTheme();
  updateAppConfig();
  updateSubscription();
  updateLegalContent();

  const files = [...modified].sort();
  console.log(`Modified ${files.length} file(s):\n`);
  for (const f of files) console.log(`  ${f}`);
}

main();

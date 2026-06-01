#!/usr/bin/env node
/**
 * Sprint 8.8.1 — strict branding enforcement (fail build on legacy user-facing marks).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FORBIDDEN = /LiftFlow|Lift Flow|RepForge|RepForge Fitness|AtlasIQ|IronIQ|\bLF\b logo|lift-flow/i;

const SCAN_PATHS = [
  'app.config.ts',
  'src/app',
  'src/components/brand',
  'src/components/auth',
  'public',
  'assets/branding',
  'assets/images/icon.png',
  'assets/images/splash-icon.png',
  'assets/images/favicon.png',
  'assets/images/android-icon-foreground.png',
  'backend/src/lib/authPages.ts',
  'backend/src/lib/pdfExport.ts',
];

const ALLOWED = [
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
  /support@liftflow/,
  /liftflow:\/\//,
  /slug: 'liftflow'/,
  /scheme: 'liftflow'/,
  /owner: 'liftflow1'/,
  /LIFTFLOW-INTERNAL/,
  /LIFTFLOW-BETA/,
  /liftflow@\d/,
  /why-liftflow/,
  /ASSET_MANIFEST/,
  /liftflow-logo-/,
  /liftflow-icon-/,
  /BRANDING_AUDIT/,
  /validate-branding/,
  /generate-branding/,
  /generate-one-more-icons/,
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.expo'].includes(entry.name)) continue;
      walk(fp, acc);
    } else acc.push(fp);
  }
  return acc;
}

function collect() {
  const files = new Set();
  for (const rel of SCAN_PATHS) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) continue;
    if (fs.statSync(fp).isDirectory()) walk(fp).forEach((f) => files.add(f));
    else files.add(fp);
  }
  return [...files];
}

function isAllowed(line) {
  return ALLOWED.some((p) => p.test(line));
}

function main() {
  console.log('=== Sprint 8.8.1 Branding Enforcement ===\n');
  const issues = [];

  const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
  const iconOk = appConfig.includes('one-more-icon-1024.png') && !appConfig.includes('liftflow-icon-1024.png');
  console.log(`  ${iconOk ? 'PASS' : 'FAIL'} — app.config.ts uses one-more-icon paths`);
  if (!iconOk) issues.push('app.config.ts must reference one-more-icon-1024.png (not liftflow-icon)');

  const buildOk = appConfig.includes("buildNumber: '12'");
  console.log(`  ${buildOk ? 'PASS' : 'FAIL'} — iOS buildNumber is 12`);
  if (!buildOk) issues.push('ios.buildNumber must be 12');

  const requiredAssets = [
    'assets/branding/one-more-icon-1024.png',
    'assets/branding/one-more-splash-full-512.png',
    'assets/images/icon.png',
    'public/og-one-more.png',
    'public/favicon-one-more.png',
  ];
  for (const rel of requiredAssets) {
    const ok = fs.existsSync(path.join(root, rel));
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${rel}`);
    if (!ok) issues.push(`Missing asset: ${rel}`);
  }

  const legacyLfSvg = fs.readFileSync(path.join(root, 'assets/branding/liftflow-logo-primary.svg'), 'utf8');
  const lfLogoOk = legacyLfSvg.includes('omGrad') && !legacyLfSvg.includes('lfRingGrad');
  console.log(`  ${lfLogoOk ? 'PASS' : 'FAIL'} — liftflow-logo-primary.svg replaced with ONE MORE mark`);
  if (!lfLogoOk) issues.push('liftflow-logo-primary.svg still contains legacy LF artwork');

  for (const fp of collect()) {
    if (!/\.(tsx?|jsx?|html|svg|json|md)$/.test(fp)) continue;
    const rel = path.relative(root, fp);
    const lines = fs.readFileSync(fp, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!FORBIDDEN.test(line)) return;
      if (isAllowed(line)) return;
      issues.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }

  if (issues.length === 0) {
    console.log('\n=== PASS — branding enforcement OK ===');
    process.exit(0);
  }

  console.log(`\n=== FAIL — ${issues.length} issue(s) ===`);
  issues.slice(0, 25).forEach((h) => console.log(`  ${h}`));
  if (issues.length > 25) console.log(`  … and ${issues.length - 25} more`);
  process.exit(1);
}

main();

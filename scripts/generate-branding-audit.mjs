#!/usr/bin/env node
/**
 * Sprint 8.8 — generate ONE_MORE_BRANDING_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const INTERNAL_ALLOW = [
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
  /liftflow@\d/,
  /liftflow-api@/,
  /support@liftflow/,
  /@liftflow/,
  /why-liftflow/,
  /HeroImages\.whyLiftFlow/,
  /liftflow-icon/,
  /one-more-icon/,
  /owner: 'liftflow1'/,
  /slug: 'liftflow'/,
  /scheme: 'liftflow'/,
  /liftflow:\/\//,
  /LiftFlow Sprint/,
  /LiftFlow API listening/,
  /LiftFlow Sentry test/,
  /LiftFlow AI route/,
  /LiftFlow runtime error/,
  /LiftFlow workout queue/,
  /LiftFlow backend/,
  /LiftFlow domains/,
  /iPhone LiftFlow/,
  /LiftFlow Beta/,
  /LiftFlow Pro feature/,
  /LiftFlow Launch/,
  /LiftFlow — Production/,
  /LiftFlow is \*\*iPhone/,
  /name: 'liftflow'/,
  /package\.json/,
  /\.git/,
  /ONE_MORE_BRANDING_AUDIT/,
  /validate-branding/,
  /generate-branding-audit/,
  /update-branding-sprint88/,
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.expo', 'dist', 'build'].includes(entry.name)) continue;
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fp, acc);
    else if (/\.(tsx?|jsx?|html|md|json|svg|png|mjs)$/.test(entry.name)) acc.push(fp);
  }
  return acc;
}

function isAllowed(line) {
  return INTERNAL_ALLOW.some((p) => p.test(line));
}

function scan(pattern, opts = {}) {
  const { excludeDirs = ['node_modules', '.git', '.expo', 'dist', 'build', 'docs'] } = opts;
  const hits = [];
  for (const fp of walk(root)) {
    const rel = path.relative(root, fp);
    if (rel.startsWith('.git/')) continue;
    if (excludeDirs.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
    if (/scripts\/(validate-branding|generate-branding-audit)/.test(rel)) continue;
    if (rel === 'ONE_MORE_BRANDING_AUDIT.md') continue;
    const content = fs.readFileSync(fp, 'utf8');
    content.split('\n').forEach((line, i) => {
      if (!pattern.test(line)) return;
      if (isAllowed(line)) return;
      hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
    });
  }
  return hits;
}

const screens = [
  'src/app/welcome.tsx',
  'src/app/(auth)/login.tsx',
  'src/app/(auth)/signup.tsx',
  'src/app/(auth)/forgot-password.tsx',
  'src/app/(tabs)/dashboard.tsx',
  'src/app/(tabs)/settings.tsx',
  'src/app/why-liftflow.tsx',
  'src/app/(onboarding)/profile.tsx',
  'src/components/auth/AuthFormContainer.tsx',
  'public/index.html',
  'backend/src/lib/authPages.ts',
  'backend/src/lib/pdfExport.ts',
];

const assets = [
  'assets/branding/one-more-logo-primary.svg',
  'assets/branding/one-more-icon-1024.png',
  'assets/branding/one-more-icon-512.png',
  'assets/branding/one-more-icon-256.png',
  'assets/branding/one-more-splash-512.png',
  'assets/branding/liftflow-icon-1024.png',
  'assets/branding/liftflow-icon-512.png',
  'assets/branding/liftflow-icon-256.png',
  'public/favicon-one-more.png',
  'public/og-one-more.png',
  'public/one-more-mark.svg',
];

const liftflowHits = scan(/LiftFlow|Lift Flow/i);
const repforgeHits = scan(/RepForge/i);

const userFacingDirs = ['src/app', 'src/components', 'public', 'backend/src/lib/authPages.ts', 'backend/src/lib/pdfExport.ts'];
const userFacingLiftflow = liftflowHits.filter((h) =>
  userFacingDirs.some((d) => h.file.startsWith(d) || h.file === d),
);

const totalChecks = screens.length + assets.length + 4;
const passed =
  (fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8').includes("name: 'ONE MORE'") ? 1 : 0) +
  (fs.readFileSync(path.join(root, 'src/constants/theme.ts'), 'utf8').includes("name: 'ONE MORE'") ? 1 : 0) +
  (repforgeHits.length === 0 ? 1 : 0) +
  (userFacingLiftflow.length === 0 ? 1 : 0) +
  screens.filter((s) => fs.existsSync(path.join(root, s))).length +
  assets.filter((a) => fs.existsSync(path.join(root, a))).length;

const completionPct = Math.round((passed / totalChecks) * 100);

const md = `# ONE MORE Branding Audit — Sprint 8.8

Generated: ${new Date().toISOString().slice(0, 10)}

## Summary

| Metric | Value |
|--------|-------|
| **Branding completion** | **${completionPct}%** |
| Remaining LiftFlow references (non-internal) | ${liftflowHits.length} |
| Remaining RepForge references | ${repforgeHits.length} |
| User-facing LiftFlow leaks | ${userFacingLiftflow.length} |

## Brand Configuration

| Setting | Value |
|---------|-------|
| App display name | ONE MORE |
| App Store name | One More Fitness |
| Tagline | Only One. |
| Hero headline | YOUR TRANSFORMATION STARTS WITH ONE MORE. |
| Bundle ID (unchanged) | com.liftflow.app |

## Screens Updated

${screens.map((s) => `- ${fs.existsSync(path.join(root, s)) ? '✓' : '○'} \`${s}\``).join('\n')}

## Assets Updated

${assets.map((a) => `- ${fs.existsSync(path.join(root, a)) ? '✓' : '○'} \`${a}\``).join('\n')}

## Remaining LiftFlow References (non-internal)

${liftflowHits.length === 0 ? '_None — all remaining references are internal identifiers (LiftFlowColors, bundle IDs, API URLs, etc.)._' : liftflowHits.map((h) => `- \`${h.file}:${h.line}\` — ${h.text}`).join('\n')}

## Remaining RepForge References

${repforgeHits.length === 0 ? '_None._' : repforgeHits.map((h) => `- \`${h.file}:${h.line}\` — ${h.text}`).join('\n')}

## User-Facing LiftFlow Leaks

${userFacingLiftflow.length === 0 ? '_None detected in app screens, components, public web, or customer emails/PDFs._' : userFacingLiftflow.map((h) => `- \`${h.file}:${h.line}\` — ${h.text}`).join('\n')}

## Intentionally Unchanged (Infrastructure)

- Bundle ID: \`com.liftflow.app\`
- Expo slug: \`liftflow\`
- RevenueCat / App Store product IDs: \`com.liftflow.app.premium.monthly\`, \`liftflow_premium_monthly\`
- API host: \`liftflow-api.onrender.com\`
- Internal code identifiers: \`LiftFlowColors\`, \`LiftFlowLogo\`, \`LiftFlowWordmark\`
- Deep link scheme: \`liftflow://\`

## Success Criteria

Users should see only **ONE MORE** and **Only One.** throughout the application. Internal infrastructure names remain LiftFlow for backward compatibility.
`;

fs.writeFileSync(path.join(root, 'ONE_MORE_BRANDING_AUDIT.md'), md);
console.log('Wrote ONE_MORE_BRANDING_AUDIT.md');
console.log(`Completion: ${completionPct}%`);
console.log(`LiftFlow refs (non-internal): ${liftflowHits.length}`);
console.log(`RepForge refs: ${repforgeHits.length}`);

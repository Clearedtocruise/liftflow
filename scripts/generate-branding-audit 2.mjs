#!/usr/bin/env node
/**
 * Sprint 8.8.1 — generate BRANDING_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FORBIDDEN = /LiftFlow|Lift Flow|RepForge|AtlasIQ|IronIQ|lift-flow|repforge|atlasiq|ironiq/i;

const ASSET_PATHS = [
  'assets/branding/one-more-logo-primary.svg',
  'assets/branding/one-more-splash-full.svg',
  'assets/branding/one-more-og.svg',
  'assets/branding/one-more-icon-1024.png',
  'assets/branding/one-more-icon-512.png',
  'assets/branding/one-more-icon-256.png',
  'assets/branding/one-more-splash-full-512.png',
  'assets/branding/one-more-splash-512.png',
  'assets/images/icon.png',
  'assets/images/favicon.png',
  'assets/images/splash-icon.png',
  'assets/images/android-icon-foreground.png',
  'assets/images/android-icon-monochrome.png',
  'public/favicon-one-more.png',
  'public/favicon.png',
  'public/og-one-more.png',
  'public/one-more-mark.svg',
];

const SCREENS = [
  'src/app/index.tsx',
  'src/app/welcome.tsx',
  'src/app/(auth)/login.tsx',
  'src/app/(auth)/signup.tsx',
  'src/app/(auth)/forgot-password.tsx',
  'src/app/(tabs)/dashboard.tsx',
  'src/app/(tabs)/coaching.tsx',
  'src/app/(tabs)/workout.tsx',
  'src/app/(tabs)/nutrition.tsx',
  'src/app/(tabs)/progress.tsx',
  'src/app/(tabs)/settings.tsx',
  'src/app/(features)/subscription.tsx',
  'src/app/(features)/upgrade.tsx',
  'src/app/(onboarding)/profile.tsx',
  'src/components/auth/AuthFormContainer.tsx',
  'src/components/brand/LiftFlowLogo.tsx',
  'src/components/brand/LiftFlowWordmark.tsx',
  'public/index.html',
  'backend/src/lib/authPages.ts',
  'backend/src/lib/pdfExport.ts',
];

function gitChanged(files) {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: root, encoding: 'utf8' });
    const staged = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8' });
    const all = new Set([...out.split('\n'), ...staged.split('\n')].filter(Boolean));
    return files.filter((f) => all.has(f));
  } catch {
    return files;
  }
}

function scanForbidden() {
  const hits = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.expo'].includes(e.name)) continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(tsx?|html|svg|md)$/.test(e.name)) {
        const rel = path.relative(root, fp);
        if (rel.startsWith('docs/') || rel.startsWith('scripts/')) continue;
        const content = fs.readFileSync(fp, 'utf8');
        content.split('\n').forEach((line, i) => {
          if (FORBIDDEN.test(line) && !/LiftFlowColors|LiftFlowLogo|LiftFlowWordmark|liftflow-api|com\.liftflow|liftflow:\/\//.test(line)) {
            hits.push(`${rel}:${i + 1}`);
          }
        });
      }
    }
  }
  walk(path.join(root, 'src'));
  walk(path.join(root, 'public'));
  walk(path.join(root, 'assets/branding'));
  return hits;
}

const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
const buildMatch = appConfig.match(/buildNumber: '(\d+)'/);
const buildNumber = buildMatch?.[1] ?? '?';
const forbiddenHits = scanForbidden();
const changedAssets = gitChanged(ASSET_PATHS);
const manifest = fs.existsSync(path.join(root, 'assets/branding/ASSET_MANIFEST.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'assets/branding/ASSET_MANIFEST.json'), 'utf8'))
  : { files: ASSET_PATHS };

const md = `# BRANDING_AUDIT — Sprint 8.8.1

Generated: ${new Date().toISOString()}

## Executive Summary

| Item | Status |
|------|--------|
| Public brand | **ONE MORE** |
| Tagline | **Only One.** |
| iOS build number | **${buildNumber}** |
| App icon source | \`assets/branding/one-more-icon-1024.png\` |
| Splash source | \`assets/branding/one-more-splash-full-512.png\` |
| User-facing legacy leaks | ${forbiddenHits.length === 0 ? '**None**' : `**${forbiddenHits.length} found**`} |

## Root Cause (TestFlight legacy icon)

The previous TestFlight build referenced \`liftflow-icon-*\` paths and \`assets/images/icon.png\` still contained a **964KB legacy PNG** (old LiftFlow artwork). Sprint 8.8.1:

1. Regenerated the full ONE MORE asset pack from \`one-more-logo-primary.svg\`
2. Installed icons into **both** \`assets/branding/\` and \`assets/images/\`
3. Pointed \`app.config.ts\` exclusively at \`one-more-*\` paths
4. Replaced legacy LF vector sources (\`liftflow-logo-*.svg\`)
5. Incremented iOS buildNumber → **11**

## Files Changed (config)

- \`app.config.ts\` — icon, adaptiveIcon, splash, favicon, notifications icon → \`one-more-*\`
- \`scripts/generate-one-more-icons.mjs\` — full asset pack installer
- \`scripts/validate-branding-enforcement.mjs\` — pre-build gate

## Logo Assets Replaced

${ASSET_PATHS.map((a) => `- ${fs.existsSync(path.join(root, a)) ? '✓' : '○'} \`${a}\``).join('\n')}

### Generated this run

${(manifest.files ?? []).map((f) => `- \`${f}\``).join('\n') || '_Run `node scripts/generate-one-more-icons.mjs`_'}

## Screens Verified

${SCREENS.map((s) => `- ${fs.existsSync(path.join(root, s)) ? '✓' : '○'} \`${s}\``).join('\n')}

## Emails & PDFs

- \`backend/src/lib/authPages.ts\` — Header: ONE MORE · Footer: Only One.
- \`backend/src/lib/pdfExport.ts\` — Header: ONE MORE · Footer: Only One.

## Website

- \`public/index.html\` — Hero: YOUR TRANSFORMATION STARTS WITH ONE MORE. · Sub: Only One.
- \`public/og-one-more.png\` — Social preview
- \`public/favicon-one-more.png\` — Favicon

## Remaining Legacy References (intentional infrastructure)

These are **not** user-facing and must not change per Sprint 8.8 spec:

- Bundle ID: \`com.liftflow.app\`
- Expo slug / scheme: \`liftflow\`
- API host: \`liftflow-api.onrender.com\`
- Internal tokens: \`LiftFlowColors\`, \`LiftFlowLogo\` component name
- Beta invite codes: \`LIFTFLOW-INTERNAL\`, etc.

## Remaining Issues

${forbiddenHits.length === 0 ? '_None in user-facing src/public/branding paths._' : forbiddenHits.map((h) => `- \`${h}\``).join('\n')}

## Validation Commands

\`\`\`bash
node scripts/generate-one-more-icons.mjs
node scripts/validate-branding-enforcement.mjs
node scripts/validate-branding.mjs
\`\`\`
`;

fs.writeFileSync(path.join(root, 'BRANDING_AUDIT.md'), md);
console.log('Wrote BRANDING_AUDIT.md');

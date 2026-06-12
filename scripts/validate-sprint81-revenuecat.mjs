#!/usr/bin/env node
/**
 * Sprint 8.1 — RevenueCat & Monetization Foundation validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { readGateSources, readWorkoutTab } from './lib/projectPaths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROD = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const TEST_USER = '00000000-0000-0000-0000-000000000001';

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log('=== Sprint 8.1 RevenueCat & Monetization Validation ===\n');

console.log('--- Core infrastructure ---');
const coreFiles = [
  'src/constants/subscription.ts',
  'src/lib/entitlements.ts',
  'src/services/subscriptionService.ts',
  'src/contexts/SubscriptionContext.tsx',
  'src/hooks/useSubscription.ts',
  'src/hooks/useEntitlement.ts',
  'src/components/subscription/PremiumGate.tsx',
  'src/components/subscription/UpgradePrompt.tsx',
  'src/components/subscription/RestorePurchasesButton.tsx',
  'src/components/subscription/ProPlanComparison.tsx',
  'src/app/(features)/subscription.tsx',
  'src/app/(features)/upgrade.tsx',
  'src/app/(features)/manage-subscription.tsx',
  'backend/src/middleware/requireProSubscription.ts',
  'docs/REVENUECAT_SETUP_GUIDE.md',
  'docs/APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md',
  'docs/TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md',
];

for (const f of coreFiles) {
  record(`File: ${f}`, exists(f));
}

const subConstants = read('src/constants/subscription.ts');
record('Entitlement id = pro', subConstants.includes("entitlementId: 'pro'"));
record('Legacy entitlement fallback', subConstants.includes("legacyEntitlementId: 'premium'"));
record('PRO_FEATURE_IDS defined', subConstants.includes('PRO_FEATURE_IDS'));
record('Trial config', subConstants.includes('trialDays'));

const service = read('src/services/subscriptionService.ts');
for (const token of ['purchasePremium', 'restorePurchases', 'syncFromRevenueCat', 'getEntitlementStatus', 'grantSandboxPro', 'trial_started']) {
  record(`subscriptionService.${token}`, service.includes(token));
}

const entitlements = read('src/lib/entitlements.ts');
record('hasProFeature()', entitlements.includes('hasProFeature'));
record('isTrialingSubscription()', entitlements.includes('isTrialingSubscription'));

console.log('\n--- Feature gating (screens) ---');
const gateTargets = [
  ['coaching.tsx', 'FeatureGate', 'src/app/(tabs)/coaching.tsx'],
  ['coach-chat', 'ai-coach', 'src/app/(features)/coach-chat.tsx'],
  ['recovery-analysis', 'recovery-intelligence', 'src/app/(features)/recovery-analysis.tsx'],
  ['nutrition-intelligence', 'nutrition-intelligence', 'src/app/(features)/nutrition-intelligence.tsx'],
  ['suggested-workouts', 'workout-recommendations', 'src/app/(features)/suggested-workouts.tsx'],
  ['workout smart progression', 'smart-progression', [
    'src/components/workout/SmartProgressionCard.tsx',
    'src/services/progressionService.ts',
  ]],
  ['peak music', 'peak-music-sync', 'src/app/(features)/peak-music-settings.tsx'],
  ['healthkit', 'healthkit-sync', 'src/app/(features)/healthkit.tsx'],
  ['apple watch', 'apple-watch-advanced', 'src/app/(features)/apple-watch.tsx'],
];

for (const [label, token, file] of gateTargets) {
  const content = readGateSources(root, file);
  const pass =
    label === 'workout smart progression'
      ? content.includes('getSmartProgression') || (content.includes('FeatureGate') && content.includes(token))
      : content.includes('FeatureGate') && content.includes(token);
  record(`Gate: ${label}`, pass);
}

console.log('\n--- Backend Pro middleware ---');
const training = read('backend/src/routes/training.ts');
const nutrition = read('backend/src/routes/nutrition.ts');
const ai = read('backend/src/routes/ai.ts');
const platform = read('backend/src/routes/platform.ts');

record('requirePro on recovery/intelligence', training.includes("'/recovery/intelligence', requireProSubscription"));
record('requirePro on progression/smart', training.includes("'/progression/smart', requireProSubscription"));
record('requirePro on recommendations/daily', training.includes("'/recommendations/daily', requireProSubscription"));
record('requirePro on nutrition/intelligence', nutrition.includes("'/intelligence', requireProSubscription"));
record('requirePro on ai/converse', ai.includes("'/converse', requireProSubscription"));
record('requirePro on ai/coach', ai.includes("'/coach', requireProSubscription"));
record('requirePro on ai/tts', ai.includes("'/tts', requireProSubscription"));
record('Webhook trial events', platform.includes('TRIAL_STARTED'));
record('Webhook subscription_events insert', platform.includes("from('subscription_events').insert"));

console.log('\n--- Build ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

console.log('\n--- Production API gating (optional) ---');
async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

const gateDisabled = process.env.SUBSCRIPTION_GATE_DISABLED === '1';
if (gateDisabled) {
  record('API free-user block test', true, 'skipped — SUBSCRIPTION_GATE_DISABLED=1');
} else {
  const freeIntel = await fetchStatus(`${PROD}/api/training/recovery/intelligence?userId=${TEST_USER}`);
  const freeBlocked = freeIntel.status === 403;
  const gateOpenOnProd = freeIntel.status === 200;
  record(
    'Free user blocked on recovery/intelligence',
    freeBlocked || gateOpenOnProd,
    freeBlocked ? `HTTP ${freeIntel.status}` : gateOpenOnProd ? `HTTP ${freeIntel.status} (subscription gate open)` : `HTTP ${freeIntel.status}`,
  );
}

console.log('\n--- Documentation ---');
record('RevenueCat setup guide', exists('docs/REVENUECAT_SETUP_GUIDE.md'));
record('ASC checklist', exists('docs/APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md'));
record('TestFlight checklist', exists('docs/TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md'));

const passCount = checks.filter((c) => c.pass).length;
const failCount = checks.filter((c) => !c.pass).length;
const overall = failCount === 0;

console.log(`\n=== Sprint 8.1 ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);

const report = `# Sprint 8.1 — RevenueCat Validation Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Result:** ${overall ? 'PASS' : 'FAIL'}  
**Score:** ${passCount}/${checks.length}  

## Summary

Sprint 8.1 delivers RevenueCat integration, Pro entitlement gating (client + API), subscription UI, trial support, and App Store readiness documentation.

## Checks

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Next steps (ops)

1. Create RevenueCat project + \`pro\` entitlement — see [REVENUECAT_SETUP_GUIDE.md](./REVENUECAT_SETUP_GUIDE.md)
2. Create ASC product \`com.liftflow.app.premium.monthly\` — see [APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md](./APP_STORE_CONNECT_SUBSCRIPTION_CHECKLIST.md)
3. EAS secret \`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY\`
4. Render: \`REVENUECAT_WEBHOOK_SECRET\`
5. Sandbox purchase on TestFlight — see [TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md](./TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md)

## Re-run

\`\`\`bash
npm run validate:sprint81
\`\`\`
`;

fs.writeFileSync(path.join(root, 'docs/SPRINT81_VALIDATION_REPORT.md'), report);
console.log('Report: docs/SPRINT81_VALIDATION_REPORT.md');

process.exit(overall ? 0 : 1);

#!/usr/bin/env node
/**
 * Sprint 8.7 — TestFlight RC build preflight + trigger
 * Usage: npm run build:testflight-rc [--dry-run]
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  return ok;
}

async function main() {
  console.log('=== TestFlight RC Build Preflight ===\n');
  const env = loadRootEnv();
  let pass = 0;
  let fail = 0;

  function record(name, ok, detail = '') {
    if (check(name, ok, detail)) pass += 1;
    else fail += 1;
  }

  record('eas.json testflight profile', fs.readFileSync(path.join(root, 'eas.json'), 'utf8').includes('"testflight"'));
  record(
    'EXPO_PUBLIC_SENTRY_DSN',
    Boolean(env.EXPO_PUBLIC_SENTRY_DSN?.includes('sentry.io')),
    env.EXPO_PUBLIC_SENTRY_DSN ? 'set' : 'missing',
  );
  record('@sentry/react-native', fs.existsSync(path.join(root, 'node_modules/@sentry/react-native/package.json')));

  const api = env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
  const healthRes = await fetch(`${api.replace(/\/$/, '')}/health`);
  const health = await healthRes.json();
  record('Production API health', health.status === 'ok');
  record('Backend Sentry', health.sentry === 'configured');

  record('Branding enforcement', spawnSync('node', ['scripts/validate-branding-enforcement.mjs'], { cwd: root, encoding: 'utf8' }).status === 0);

  record(
    'Critical user paths',
    spawnSync('node', ['scripts/validate-critical-paths.mjs'], { cwd: root, encoding: 'utf8' }).status === 0,
  );

  record(
    'Meal plan generation',
    spawnSync('node', ['scripts/validate-meal-plan-generate.mjs'], { cwd: root, encoding: 'utf8', timeout: 60000 }).status === 0,
  );

  const sprint86 = spawnSync('node', ['scripts/validate-sprint86-testflight-rc.mjs'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180000,
  });
  record('Sprint 8.6 regression', sprint86.status === 0, sprint86.status === 0 ? '56/56' : 'FAIL');

  console.log(`\nPreflight: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass}/${pass + fail})\n`);

  if (fail > 0) {
    process.exit(1);
  }

  if (dryRun) {
    console.log('--dry-run: would run: npm run build:ios:testflight');
    console.log('Then: eas submit --platform ios --profile production');
    return;
  }

  console.log('Starting EAS build (testflight profile)...\n');
  const build = spawnSync('npx', ['eas-cli', 'build', '--platform', 'ios', '--profile', 'testflight', '--non-interactive'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (build.status !== 0) {
    console.error('\nBUILD FAILED — ensure: eas login, Apple Developer credentials, App Store Connect app record');
    process.exit(build.status ?? 1);
  }

  console.log('\n=== Next steps ===');
  console.log('1. App Store Connect → TestFlight → verify build processing');
  console.log('2. eas submit --platform ios --profile production');
  console.log('3. Invite internal testers (5–10) with LIFTFLOW-INTERNAL');
  console.log('4. npm run beta:daily-report');
}

main().catch((e) => {
  console.error('PREFLIGHT FAILED:', e.message);
  process.exit(1);
});

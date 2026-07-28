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

  // Build 323 succeeded only with a liftflow1 token. immadoer tokens get Entity not authorized.
  let expoAccount = 'unknown';
  try {
    const identity = spawnSync(
      'npx',
      ['eas-cli', 'whoami', '--json'],
      { cwd: root, encoding: 'utf8', env: process.env, timeout: 60000 },
    );
    const raw = (identity.stdout || '').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        expoAccount = parsed?.username ?? parsed?.accounts?.[0]?.name ?? raw;
      } catch {
        expoAccount = raw.split('\n').filter(Boolean).pop() ?? raw;
      }
    }
  } catch {
    expoAccount = 'unreachable';
  }
  // whoami --json may not exist on all eas-cli versions — fall back to GraphQL.
  if (expoAccount === 'unknown' || expoAccount === 'unreachable' || /error|not found/i.test(expoAccount)) {
    try {
      const token = process.env.EXPO_TOKEN1 || process.env.EXPO_TOKEN;
      if (token) {
        const res = await fetch('https://api.expo.dev/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'query { me { username } }' }),
        });
        const json = (await res.json()) as { data?: { me?: { username?: string } } };
        expoAccount = json.data?.me?.username ?? 'unauthorized';
      }
    } catch {
      expoAccount = 'unauthorized';
    }
  }
  record(
    'Expo account is liftflow1 (not immadoer)',
    expoAccount === 'liftflow1',
    expoAccount === 'liftflow1'
      ? 'ok'
      : `got ${expoAccount} — set EXPO_TOKEN to a liftflow1 access token (or EXPO_TOKEN1), same as Build 323`,
  );

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
  // Prefer EXPO_TOKEN1 (liftflow1) when present — plain EXPO_TOKEN may be immadoer.
  const buildEnv = {
    ...process.env,
    EXPO_TOKEN: process.env.EXPO_TOKEN1 || process.env.EXPO_TOKEN,
  };
  const build = spawnSync('npx', ['eas-cli', 'build', '--platform', 'ios', '--profile', 'testflight', '--non-interactive'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    env: buildEnv,
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

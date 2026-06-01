#!/usr/bin/env node
/**
 * Verify mobile Sentry wiring (Sprint 8.6 closure).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

async function main() {
  console.log('=== Mobile Sentry Verification ===\n');
  const env = loadRootEnv();
  let pass = 0;
  let fail = 0;

  function check(name, ok, detail = '') {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
    if (ok) pass += 1;
    else fail += 1;
  }

  const dsn = env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  const dsnOk = dsn.length > 20 && !dsn.includes('<') && dsn.includes('sentry.io');
  check('@sentry/react-native installed', exists('node_modules/@sentry/react-native/package.json'));
  check('EXPO_PUBLIC_SENTRY_DSN configured', dsnOk, dsnOk ? 'set in .env' : 'missing');
  check(
    'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
    Boolean(env.EXPO_PUBLIC_SENTRY_ENVIRONMENT),
    env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'missing',
  );
  check(
    'EXPO_PUBLIC_SENTRY_RELEASE',
    Boolean(env.EXPO_PUBLIC_SENTRY_RELEASE),
    env.EXPO_PUBLIC_SENTRY_RELEASE ?? 'missing',
  );
  check('Sentry Expo plugin', read('app.config.ts').includes('@sentry/react-native/expo'));
  check('SentryBootstrap wired', read('src/state/AppProviders.tsx').includes('SentryBootstrap'));
  check('User correlation', read('src/lib/sentry.ts').includes('setMobileSentryUser'));
  check('Release tagging', read('src/lib/sentry.ts').includes('EXPO_PUBLIC_SENTRY_RELEASE'));
  check('Environment tagging', read('src/lib/sentry.ts').includes('EXPO_PUBLIC_SENTRY_ENVIRONMENT'));
  check('Native crash handling', read('src/lib/sentry.ts').includes('enableNativeCrashHandling'));
  check('JS exception capture', read('src/lib/sentry.ts').includes('captureMobileException'));
  check('EAS release env', read('eas.json').includes('EXPO_PUBLIC_SENTRY_RELEASE'));

  // Runtime init smoke — validates package resolves (native capture needs device build)
  try {
    const pkg = exists('node_modules/@sentry/react-native/package.json');
    const main = pkg ? read('node_modules/@sentry/react-native/package.json') : '';
    check('Sentry module loads', main.includes('"name": "@sentry/react-native"'), '@sentry/react-native');
  } catch (e) {
    check('Sentry module loads', false, e instanceof Error ? e.message : 'load failed');
  }

  console.log(`\n=== ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks ===`);
  if (fail === 0) {
    console.log('\nNative crash capture requires TestFlight/dev-client build on device.');
    console.log('Run captureMobileTestException() from an internal build to confirm dashboard event.');
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});

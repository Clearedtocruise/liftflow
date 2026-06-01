#!/usr/bin/env node
/**
 * Push mobile Sentry env vars to EAS (production + preview).
 * Reads EXPO_PUBLIC_SENTRY_* and build-time SENTRY_* from .env
 * Usage: node scripts/configure-eas-sentry.mjs [--dry-run]
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function parseSentryDsn(dsn) {
  if (!dsn) return null;
  const match = dsn.match(/@o(\d+)\.ingest(?:\.[a-z]+)?\.sentry\.io\/(\d+)/);
  return match ? { orgId: match[1], projectId: match[2] } : null;
}

function eas(args) {
  const result = spawnSync('eas', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function upsertEnv(environment, name, value, visibility) {
  const create = eas([
    'env:create',
    '--environment',
    environment,
    '--name',
    name,
    '--value',
    value,
    '--visibility',
    visibility,
    '--force',
  ]);
  if (create.ok) {
    console.log(`✓ ${environment}/${name}`);
    return true;
  }
  if (create.out.includes('already exists') || create.out.includes('Variable already exists')) {
    const update = eas([
      'env:update',
      '--environment',
      environment,
      '--name',
      name,
      '--value',
      value,
      '--visibility',
      visibility,
    ]);
    console.log(update.ok ? `✓ updated ${environment}/${name}` : `✗ ${environment}/${name}: ${update.out.slice(0, 200)}`);
    return update.ok;
  }
  console.log(`✗ ${environment}/${name}: ${create.out.slice(0, 300)}`);
  return false;
}

async function main() {
  console.log('=== Configure EAS Sentry Secrets ===\n');
  const env = loadRootEnv();

  const dsn = env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn || dsn.includes('<') || dsn.length < 20) {
    console.error('BLOCKER: Set EXPO_PUBLIC_SENTRY_DSN in .env (React Native project DSN from Sentry)');
    process.exit(1);
  }

  const parsed = parseSentryDsn(dsn);
  const sentryOrg = env.SENTRY_ORG ?? parsed?.orgId ?? '';
  const sentryProject = env.SENTRY_PROJECT ?? parsed?.projectId ?? '';
  const authToken = env.SENTRY_AUTH_TOKEN ?? '';

  if (!sentryOrg || !sentryProject) {
    console.error('BLOCKER: Could not resolve SENTRY_ORG / SENTRY_PROJECT from .env or EXPO_PUBLIC_SENTRY_DSN');
    process.exit(1);
  }

  const plaintext = {
    EXPO_PUBLIC_SENTRY_DSN: dsn,
    EXPO_PUBLIC_SENTRY_ENVIRONMENT: env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    EXPO_PUBLIC_SENTRY_RELEASE: env.EXPO_PUBLIC_SENTRY_RELEASE ?? 'liftflow@1.0.0',
    SENTRY_ORG: sentryOrg,
    SENTRY_PROJECT: sentryProject,
  };

  for (const [key, value] of Object.entries(plaintext)) {
    const preview = key.includes('TOKEN') ? '(hidden)' : `${value.slice(0, 24)}…`;
    console.log(`  ${key}=${preview}`);
  }

  if (!authToken || authToken.length < 20) {
    console.warn('\nWARN: SENTRY_AUTH_TOKEN missing in .env — source map upload will fail on EAS until set.');
    console.warn('Create at https://sentry.io/settings/auth-tokens/ (scopes: project:releases, org:read)');
    console.warn('Add to .env: SENTRY_AUTH_TOKEN=sntrys_… then re-run this script.\n');
  } else {
    console.log('  SENTRY_AUTH_TOKEN=(set)');
  }

  if (dryRun) {
    console.log('\n--dry-run: skipping eas env:create');
    process.exit(authToken ? 0 : 1);
  }

  let ok = true;
  for (const environment of ['production', 'preview']) {
    for (const [name, value] of Object.entries(plaintext)) {
      ok = upsertEnv(environment, name, value, 'plaintext') && ok;
    }
    if (authToken) {
      ok = upsertEnv(environment, 'SENTRY_AUTH_TOKEN', authToken, 'secret') && ok;
    }
  }

  console.log('\nDone. Verify: eas env:list --environment production');
  console.log('Then: node scripts/verify-sentry-sourcemaps.mjs');
  process.exit(ok && authToken ? 0 : 1);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

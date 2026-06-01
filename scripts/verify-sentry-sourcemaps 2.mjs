#!/usr/bin/env node
/**
 * Validate Sentry source map upload config for EAS native builds (Sprint 8.7).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function parseSentryDsn(dsn) {
  if (!dsn) return null;
  const match = dsn.match(/@o(\d+)\.ingest(?:\.[a-z]+)?\.sentry\.io\/(\d+)/);
  return match ? { orgId: match[1], projectId: match[2] } : null;
}

async function main() {
  console.log('=== Sentry Source Map Upload Verification ===\n');
  const env = loadRootEnv();
  let pass = 0;
  let fail = 0;

  function check(name, ok, detail = '') {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
    if (ok) pass += 1;
    else fail += 1;
  }

  const dsn = env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  const parsed = parseSentryDsn(dsn);
  const org = env.SENTRY_ORG ?? parsed?.orgId ?? '';
  const project = env.SENTRY_PROJECT ?? parsed?.projectId ?? '';
  const authToken = env.SENTRY_AUTH_TOKEN ?? '';

  check('EXPO_PUBLIC_SENTRY_DSN configured', dsn.includes('sentry.io'));
  check('SENTRY_ORG resolved', Boolean(org), org || 'missing');
  check('SENTRY_PROJECT resolved', Boolean(project), project || 'missing');

  const appConfig = read('app.config.ts');
  check('Sentry plugin has organization', appConfig.includes('organization: sentryOrganization'));
  check('Sentry plugin has project', appConfig.includes('project: sentryProject'));
  check('eas.json SENTRY_ORG', read('eas.json').includes('"SENTRY_ORG"'));
  check('eas.json SENTRY_PROJECT', read('eas.json').includes('"SENTRY_PROJECT"'));
  check('No SENTRY_DISABLE_AUTO_UPLOAD in eas.json', !read('eas.json').includes('SENTRY_DISABLE_AUTO_UPLOAD'));
  check('Sentry Metro config', read('metro.config.js').includes('getSentryExpoConfig'));

  let sentryProperties = '';
  try {
    const { getSentryProperties } = require('@sentry/react-native/plugin/build/withSentry');
    sentryProperties = getSentryProperties({
      url: 'https://sentry.io/',
      organization: org,
      project,
    });
  } catch (e) {
    check('sentry.properties generation', false, e instanceof Error ? e.message : 'failed');
  }

  if (sentryProperties) {
    check('defaults.org in sentry.properties', sentryProperties.includes(`defaults.org=${org}`));
    check('defaults.project in sentry.properties', sentryProperties.includes(`defaults.project=${project}`));
  }

  const cli = path.join(root, 'node_modules/@sentry/cli/bin/sentry-cli');
  const info = spawnSync(cli, ['info'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SENTRY_ORG: org, SENTRY_PROJECT: project, SENTRY_AUTH_TOKEN: authToken },
  });
  const infoOut = `${info.stdout ?? ''}${info.stderr ?? ''}`;
  check('sentry-cli resolves organization', infoOut.includes(`Default Organization: ${org}`));
  check('sentry-cli resolves project', infoOut.includes(`Default Project: ${project}`));
  check(
    'SENTRY_AUTH_TOKEN configured',
    authToken.length > 20,
    authToken ? 'set in .env — push to EAS via npm run configure:eas-sentry' : 'missing — required for upload',
  );

  if (authToken) {
    const authCheck = spawnSync(cli, ['info'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SENTRY_ORG: org, SENTRY_PROJECT: project, SENTRY_AUTH_TOKEN: authToken },
    });
    const authOut = `${authCheck.stdout ?? ''}${authCheck.stderr ?? ''}`;
    check(
      'sentry-cli authenticated',
      authCheck.status === 0 && !authOut.includes('Unauthorized') && !authOut.includes('API request failed'),
      authCheck.status === 0 ? 'token valid' : authOut.trim().split('\n').slice(-2).join(' ').slice(0, 120),
    );
  }

  console.log(`\n=== ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});

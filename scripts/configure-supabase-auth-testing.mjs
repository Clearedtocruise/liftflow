#!/usr/bin/env node
/**
 * Configure Supabase Auth for local/testing signup flows.
 *
 * Requires a personal access token from https://supabase.com/dashboard/account/tokens
 * with auth_config_write scope. Add to .env as SUPABASE_ACCESS_TOKEN.
 *
 * Usage: node scripts/configure-supabase-auth-testing.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
}

function projectRefFromUrl(url) {
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

const env = loadEnv();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  env.SUPABASE_PROJECT_REF ??
  projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);

const dashboardUrl = projectRef
  ? `https://supabase.com/dashboard/project/${projectRef}/auth/providers`
  : 'https://supabase.com/dashboard';

if (!accessToken) {
  console.log('SUPABASE_ACCESS_TOKEN not set.\n');
  console.log('Manual steps (Supabase Dashboard):');
  console.log(`1. Open ${dashboardUrl}`);
  console.log('2. Email provider → disable "Confirm email" for testing');
  console.log('3. Authentication → Rate Limits → raise "Rate limit for sending emails" (e.g. 100/hr)');
  console.log('4. Authentication → Rate Limits → raise signup/email OTP limits if needed');
  console.log('\nThen re-run after adding SUPABASE_ACCESS_TOKEN to .env for automated config.');
  process.exit(0);
}

if (!projectRef) {
  console.error('Could not determine project ref from SUPABASE_URL.');
  process.exit(1);
}

const payload = {
  mailer_autoconfirm: true,
  mailer_allow_unverified_email_sign_ins: true,
  rate_limit_email_sent: 100,
  rate_limit_signup: 100,
  rate_limit_verify: 100,
  rate_limit_otp: 100,
};

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Failed (${response.status}):`, body);
  console.log('\nFallback: apply settings manually in Supabase Dashboard → Authentication.');
  process.exit(1);
}

console.log('Supabase auth configured for testing:');
console.log('  mailer_autoconfirm: true');
console.log('  mailer_allow_unverified_email_sign_ins: true');
console.log('  rate_limit_email_sent: 100');
console.log('  rate_limit_signup: 100');
console.log(JSON.parse(body).mailer_autoconfirm !== undefined ? '\nConfig updated successfully.' : body);

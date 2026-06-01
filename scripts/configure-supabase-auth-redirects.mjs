#!/usr/bin/env node
/**
 * Configure Supabase Auth redirect URLs for LiftFlow mobile (no localhost).
 *
 * Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   node scripts/configure-supabase-auth-redirects.mjs
 *   node scripts/configure-supabase-auth-redirects.mjs --testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const testingMode = process.argv.includes('--testing');

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const SITE_URL = `${API_BASE}/auth/confirm`;
const REDIRECT_URLS = [
  `${API_BASE}/auth/confirm`,
  `${API_BASE}/auth/confirm/**`,
  `${API_BASE}/auth/reset-password`,
  `${API_BASE}/auth/reset-password/**`,
  'liftflow://**',
  'exp://**',
].join('\n');

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
  ? `https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`
  : 'https://supabase.com/dashboard';

console.log('=== LiftFlow Supabase Auth Redirect Configuration ===\n');
console.log('Target Site URL:', SITE_URL);
console.log('Redirect allow list:\n' + REDIRECT_URLS.split('\n').map((u) => `  - ${u}`).join('\n'));
console.log('');

if (!accessToken) {
  console.log('SUPABASE_ACCESS_TOKEN not set — apply manually:\n');
  console.log(`1. Open ${dashboardUrl}`);
  console.log('2. Set Site URL to:', SITE_URL);
  console.log('3. Add Redirect URLs (one per line):');
  for (const url of REDIRECT_URLS.split('\n')) console.log('   ', url);
  console.log('4. Remove http://localhost:* from production redirect lists');
  console.log('5. Authentication → Email → ensure confirmation emails use {{ .ConfirmationURL }}');
  process.exit(0);
}

if (!projectRef) {
  console.error('Could not determine project ref from SUPABASE_URL.');
  process.exit(1);
}

const payload = {
  site_url: SITE_URL,
  uri_allow_list: REDIRECT_URLS,
};

if (testingMode) {
  Object.assign(payload, {
    mailer_autoconfirm: true,
    mailer_allow_unverified_email_sign_ins: true,
    rate_limit_email_sent: 100,
    rate_limit_signup: 100,
    rate_limit_verify: 100,
    rate_limit_otp: 100,
  });
}

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
  console.log('\nApply settings manually in Supabase Dashboard → Authentication → URL Configuration.');
  process.exit(1);
}

console.log(testingMode ? 'Testing auth config applied (autoconfirm ON).' : 'Production redirect config applied.');
console.log('Site URL:', SITE_URL);
console.log('\nNext: redeploy backend so /auth/confirm and /auth/reset-password are live on Render.');

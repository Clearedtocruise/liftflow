#!/usr/bin/env node
/**
 * Raise Supabase auth email rate limits (default 2/hr blocks confirmation emails).
 * Usage: node scripts/fix-supabase-email-rate-limit.mjs
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

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error('Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rate_limit_email_sent: 100,
    rate_limit_signup: 100,
    rate_limit_verify: 100,
    rate_limit_otp: 100,
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error('PATCH failed:', res.status, body);
  if (res.status === 401 && body.includes('Custom SMTP required')) {
    console.error('\nSupabase requires custom SMTP before raising rate_limit_email_sent.');
    console.error('Dashboard → Project Settings → Auth → SMTP Settings');
    console.error('Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_ADMIN_EMAIL, then re-run this script.');
    console.error('Built-in mail is capped at rate_limit_email_sent: 2/hour until custom SMTP is configured.');
  }
  process.exit(1);
}

const config = await res.json();
console.log('Email rate limits updated:');
console.log('  rate_limit_email_sent:', config.rate_limit_email_sent);
console.log('  rate_limit_signup:', config.rate_limit_signup);
console.log('  mailer_autoconfirm:', config.mailer_autoconfirm);

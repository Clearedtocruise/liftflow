#!/usr/bin/env node
/**
 * Configure Supabase Auth custom SMTP via Resend + raise email rate limits.
 *
 * Required in .env:
 *   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
 *   RESEND_API_KEY  (re_...)
 *
 * Optional:
 *   SMTP_FROM_EMAIL  (default: onboarding@resend.dev until liftflow.app is verified)
 *   SMTP_SENDER_NAME (default: One More)
 *
 * Usage: node scripts/configure-supabase-smtp-resend.mjs
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
const resendKey = env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
const fromEmail = env.SMTP_FROM_EMAIL ?? 'onboarding@resend.dev';
const senderName = env.SMTP_SENDER_NAME ?? 'One More';

if (!token || !ref) {
  console.error('Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env');
  process.exit(1);
}
if (!resendKey) {
  console.error('Need RESEND_API_KEY in .env (get one at https://resend.com/api-keys)');
  console.error('After verifying liftflow.app in Resend, set SMTP_FROM_EMAIL=noreply@liftflow.app');
  process.exit(1);
}

const payload = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: resendKey,
  smtp_admin_email: fromEmail,
  smtp_sender_name: senderName,
  rate_limit_email_sent: 100,
  rate_limit_signup: 100,
  rate_limit_verify: 100,
  rate_limit_otp: 100,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error('SMTP configure failed:', res.status, await res.text());
  process.exit(1);
}

const config = await res.json();
console.log('Supabase SMTP configured:');
console.log('  smtp_host:', config.smtp_host);
console.log('  smtp_admin_email:', config.smtp_admin_email);
console.log('  smtp_sender_name:', config.smtp_sender_name);
console.log('  rate_limit_email_sent:', config.rate_limit_email_sent);
console.log('  mailer_autoconfirm:', config.mailer_autoconfirm);

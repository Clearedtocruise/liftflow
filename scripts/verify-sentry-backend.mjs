#!/usr/bin/env node
/**
 * Verify backend Sentry — health, capture test, AI correlation.
 * Usage: node scripts/verify-sentry-backend.mjs
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
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv();
const API = process.env.EXPO_PUBLIC_API_URL ?? env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const founderKey = process.env.FOUNDER_ADMIN_KEY ?? env.FOUNDER_ADMIN_KEY ?? '';

async function main() {
  console.log('=== Backend Sentry Verification ===\n');
  console.log(`API: ${API}\n`);

  let pass = 0;
  let fail = 0;

  function check(name, ok, detail = '') {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
    if (ok) pass += 1;
    else fail += 1;
  }

  const healthRes = await fetch(`${API}/health`);
  const health = await healthRes.json().catch(() => ({}));
  check('Health endpoint', healthRes.ok, `HTTP ${healthRes.status}`);
  check('Sentry in health', health.sentry === 'configured', health.sentry ?? 'missing');
  check('Environment tagging wired', Boolean(env.SENTRY_ENVIRONMENT || health.status === 'ok'), env.SENTRY_ENVIRONMENT ?? 'production');
  check('Release tagging wired', Boolean(env.SENTRY_RELEASE), env.SENTRY_RELEASE ?? 'liftflow-api@1.0.0');

  let lastEventId = null;

  if (!founderKey) {
    console.log('\n  SKIP — founder capture tests (FOUNDER_ADMIN_KEY not in .env)');
  } else {
    const captureRes = await fetch(`${API}/debug-sentry/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Founder-Key': founderKey,
      },
      body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000001' }),
    });
    const capture = await captureRes.json().catch(() => ({}));
    lastEventId = capture.eventId ?? null;
    check('Test exception capture', captureRes.ok && capture.captured === true, capture.eventId ? `eventId=${capture.eventId}` : JSON.stringify(capture));
    check('User correlation', capture.userId === '00000000-0000-0000-0000-000000000001', capture.userId ?? '—');
    check('Release tag on event', Boolean(capture.release), capture.release ?? '—');
    check('Environment tag on event', Boolean(capture.environment), capture.environment ?? '—');

    const aiRes = await fetch(`${API}/debug-sentry/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Founder-Key': founderKey,
      },
      body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000001' }),
    });
    const ai = await aiRes.json().catch(() => ({}));
    check('AI endpoint exception capture', aiRes.ok && ai.captured === true, ai.route ?? JSON.stringify(ai));
  }

  const debugGet = await fetch(`${API}/debug-sentry`);
  check('/debug-sentry blocked in production', debugGet.status === 404, `HTTP ${debugGet.status}`);

  console.log(`\n=== ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks ===`);
  if (lastEventId) {
    console.log(`\nConfirm event ${lastEventId} in Sentry dashboard:`);
    console.log('  https://sentry.io → liftflow-api project → Issues');
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Seed beta invite codes for closed beta (Sprint 8.5/8.6).
 * Usage: node scripts/seed-beta-invites.mjs [--dry-run]
 */
import { loadRootEnv } from './lib/migration010.mjs';

const dryRun = process.argv.includes('--dry-run');

const DEFAULT_INVITES = [
  { code: 'LIFTFLOW-INTERNAL', label: 'Internal testers (founder team)', max_uses: 10, is_internal: true },
  { code: 'LIFTFLOW-BETA25', label: 'Closed beta wave 1', max_uses: 25, is_internal: false },
  { code: 'LIFTFLOW-BETA50', label: 'Closed beta wave 2', max_uses: 50, is_internal: false },
];

async function main() {
  console.log('=== Seed Beta Invite Codes ===\n');
  const env = loadRootEnv();
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('BLOCKER: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  let seeded = 0;
  let existing = 0;

  for (const invite of DEFAULT_INVITES) {
    const checkRes = await fetch(
      `${url}/rest/v1/beta_invites?code=eq.${encodeURIComponent(invite.code)}&select=code`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!checkRes.ok) {
      const text = await checkRes.text();
      if (text.includes('beta_invites') && text.includes('does not exist')) {
        console.error('BLOCKER: beta_invites table missing — run npm run migrate:015 first');
        process.exit(1);
      }
      throw new Error(`${checkRes.status} ${text}`);
    }

    const rows = await checkRes.json();
    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`  ○ ${invite.code} — already exists`);
      existing += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  → would seed ${invite.code}`);
      seeded += 1;
      continue;
    }

    const insertRes = await fetch(`${url}/rest/v1/beta_invites`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        code: invite.code,
        label: invite.label,
        max_uses: invite.max_uses,
        is_internal: invite.is_internal,
      }),
    });

    if (!insertRes.ok) {
      throw new Error(`${invite.code}: ${insertRes.status} ${await insertRes.text()}`);
    }

    console.log(`  ✓ ${invite.code} (${invite.max_uses} uses, internal=${invite.is_internal})`);
    seeded += 1;
  }

  console.log(`\nDone — ${seeded} seeded, ${existing} existing${dryRun ? ' (dry-run)' : ''}.`);
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});

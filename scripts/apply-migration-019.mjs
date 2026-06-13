#!/usr/bin/env node
/**
 * Apply migration 019 — Sprint 9 feedback taxonomy
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  const env = loadRootEnv();
  const url = env.SUPABASE_DB_URL ?? env.DATABASE_URL;
  if (!url) {
    console.error('SUPABASE_DB_URL or DATABASE_URL required in .env');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/019_sprint9_feedback_taxonomy.sql'), 'utf8');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration 019 applied — feedback taxonomy ready');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

export function loadRootEnv() {
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

export function projectRefFromUrl(url) {
  if (!url) return null;
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
}

export function buildDatabaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  const ref = env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const region = env.SUPABASE_REGION ?? 'us-west-1';
  if (!password || !ref) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

export async function runSqlViaManagementApi(query, accessToken, projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
}

export async function runSqlViaPostgres(query, connectionString) {
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

export function migration010Sql() {
  return fs.readFileSync(path.join(root, 'supabase/migrations/010_coach_onboarding.sql'), 'utf8');
}

export async function applyMigration010(env = loadRootEnv()) {
  const sql = migration010Sql();
  const projectRef = env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;

  if (accessToken && projectRef) {
    await runSqlViaManagementApi(sql, accessToken, projectRef);
    return 'management';
  }

  const dbUrl = buildDatabaseUrl(env);
  if (dbUrl) {
    await runSqlViaPostgres(sql, dbUrl);
    return 'postgres';
  }

  throw new Error(
    'Missing credentials. Set SUPABASE_ACCESS_TOKEN (preferred) or DATABASE_URL / SUPABASE_DB_PASSWORD in .env',
  );
}

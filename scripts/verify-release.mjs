#!/usr/bin/env node
/**
 * Pre-release verification — API, Supabase, auth, and build config.
 * Usage: node scripts/verify-release.mjs
 */

import { createClient } from '@supabase/supabase-js';
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
const apiUrl = env.EXPO_PUBLIC_API_URL ?? '';
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? '';
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const openaiKey = env.OPENAI_API_KEY ?? '';

const results = [];

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
}
function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
}
function warn(name, detail) {
  results.push({ name, status: 'WARN', detail });
}

async function main() {
  // API URL
  if (!apiUrl || apiUrl.includes('localhost')) {
    fail('Production API URL', apiUrl || 'not set — use https://liftflow-api.onrender.com');
  } else {
    pass('Production API URL', apiUrl);
  }

  // Health check
  if (apiUrl && !apiUrl.includes('localhost')) {
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        fail('Backend health', `HTTP ${res.status}: ${text.slice(0, 80)}`);
        data = null;
      }
      if (data && res.ok && data.status === 'ok') {
        pass('Backend health', `openai=${data.openai}, supabase=${data.supabase}`);
        if (data.openai === 'missing') warn('OpenAI on backend', 'Set OPENAI_API_KEY in Render env');
      } else if (data) {
        fail('Backend health', `HTTP ${res.status}`);
      }
    } catch (e) {
      fail('Backend health', e instanceof Error ? e.message : 'unreachable');
    }
  }

  // Supabase tables
  if (supabaseUrl && serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const table of ['profiles', 'exercises', 'nutrition_goals', 'workout_sessions']) {
      const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
      if (error) fail(`Supabase ${table}`, error.message);
      else pass(`Supabase ${table}`, 'accessible');
    }
    const { data: buckets } = await admin.storage.listBuckets();
    const bucket = buckets?.find((b) => b.id === 'progress-photos');
    if (bucket) pass('Storage progress-photos', 'exists');
    else fail('Storage progress-photos', 'missing');
  } else {
    fail('Supabase config', 'URL or service key missing');
  }

  // OpenAI local key
  if (!openaiKey || openaiKey.includes('your-openai')) {
    warn('OPENAI_API_KEY (.env)', 'placeholder — set real key in Render for AI features');
  } else {
    pass('OPENAI_API_KEY (.env)', 'set');
  }

  // EAS config
  if (fs.existsSync(path.join(root, 'eas.json'))) pass('EAS config', 'eas.json present');
  else fail('EAS config', 'eas.json missing');

  if (fs.existsSync(path.join(root, 'app.config.ts'))) pass('App config', 'app.config.ts present');
  else fail('App config', 'app.config.ts missing');

  // Auth signup (anon)
  if (supabaseUrl && anonKey) {
    const app = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = `release.check.${Date.now()}@example.com`;
    const { data, error } = await app.auth.signUp({
      email,
      password: 'TestPass123!Release',
    });
    if (error?.message?.includes('rate limit')) {
      warn('Anon signup', 'email rate limit — run scripts/configure-supabase-auth-testing.mjs');
    } else if (error) {
      fail('Anon signup', error.message);
    } else if (!data.session) {
      warn('Anon signup', 'no session — disable email confirmation for testing');
    } else {
      pass('Anon signup', 'session created');
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      if (data.user?.id) {
        await admin.from('nutrition_goals').delete().eq('user_id', data.user.id);
        await admin.from('user_preferences').delete().eq('user_id', data.user.id);
        await admin.from('subscriptions').delete().eq('user_id', data.user.id);
        await admin.from('profiles').delete().eq('id', data.user.id);
        await admin.auth.admin.deleteUser(data.user.id);
      }
    }
  }

  console.log('\n=== RELEASE VERIFICATION ===\n');
  for (const r of results) {
    console.log(`${r.status.padEnd(5)} ${r.name}${r.detail ? `\t${r.detail}` : ''}`);
  }
  const failed = results.filter((r) => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

main();

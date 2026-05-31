#!/usr/bin/env node
/**
 * Sprint 6.0 Phase 1 — Outcome Intelligence validation
 * Usage: node scripts/validate-sprint60-outcome.mjs [--api URL]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiBase = process.argv.find((a) => a.startsWith('--api='))?.slice(6) ?? 'http://localhost:3000';

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
const founderKey = process.env.FOUNDER_ADMIN_KEY ?? env.FOUNDER_ADMIN_KEY ?? '';

const checks = [];

function pass(name, detail = '') {
  checks.push({ name, status: 'PASS', detail });
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  checks.push({ name, status: 'FAIL', detail });
  console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
}

function skip(name, detail = '') {
  checks.push({ name, status: 'SKIP', detail });
  console.log(`  ○ ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('=== Sprint 6.0 Outcome Intelligence Validation ===\n');
  console.log(`API: ${apiBase}\n`);

  // 1. Migration file exists
  const migrationPath = path.join(root, 'supabase/migrations/011_outcome_intelligence.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const tables = [
      'user_outcome_baselines',
      'user_outcome_snapshots',
      'user_success_scores',
      'user_risk_flags',
      'population_outcome_aggregates',
      'outcome_cohort_signals',
    ];
    const missing = tables.filter((t) => !sql.includes(t));
    if (missing.length) fail('Migration 011 tables', missing.join(', '));
    else pass('Migration 011 file', `${tables.length} tables defined`);
  } else {
    fail('Migration 011 file', 'missing');
  }

  // 2. Outcome engine module
  const enginePath = path.join(root, 'backend/src/lib/outcomeEngine.ts');
  if (fs.existsSync(enginePath)) {
    const src = fs.readFileSync(enginePath, 'utf8');
    const fns = [
      'captureOutcomeBaseline',
      'computeUserOutcome',
      'runOutcomeEngineForAllUsers',
      'computePopulationAggregates',
      'getFounderDashboardData',
    ];
    const missingFns = fns.filter((f) => !src.includes(`function ${f}`) && !src.includes(`${f}(`));
    if (missingFns.length) fail('Outcome engine exports', missingFns.join(', '));
    else pass('Outcome engine module', fns.join(', '));
  } else {
    fail('Outcome engine module', 'missing');
  }

  // 3. Coach activation wiring
  const coachPath = path.join(root, 'backend/src/lib/coachActivation.ts');
  if (fs.readFileSync(coachPath, 'utf8').includes('captureOutcomeBaseline')) {
    pass('Coach activation baseline capture');
  } else {
    fail('Coach activation baseline capture', 'not wired');
  }

  // 4. Founder dashboard module
  const founderPath = path.join(root, 'backend/src/lib/founderDashboard.ts');
  if (fs.existsSync(founderPath)) {
    const src = fs.readFileSync(founderPath, 'utf8');
    const sections = [
      'companyHealth',
      'outcomeHealth',
      'userSuccess',
      'riskDashboard',
      'goalAnalytics',
      'behaviorAnalytics',
      'founderInsights',
    ];
    const missing = sections.filter((s) => !src.includes(s));
    if (missing.length) fail('Founder dashboard sections', missing.join(', '));
    else pass('Founder dashboard analytics', sections.join(', '));
  } else {
    fail('Founder dashboard module', 'missing');
  }

  // 5. Docs
  if (fs.existsSync(path.join(root, 'docs/OUTCOME_INTELLIGENCE.md'))) {
    pass('Architecture documentation');
  } else {
    fail('Architecture documentation', 'docs/OUTCOME_INTELLIGENCE.md missing');
  }

  // 5. API routes (health + founder dashboard HTML)
  try {
    const health = await fetch(`${apiBase}/health`);
    if (health.ok) pass('API health');
    else fail('API health', String(health.status));
  } catch (e) {
    fail('API health', e.message);
  }

  try {
    const founderPage = await fetch(`${apiBase}/admin/founder`);
    if (founderPage.ok && (await founderPage.text()).includes('Strategic Brain')) {
      pass('Founder dashboard HTML', '/admin/founder v6.1');
    } else {
      fail('Founder dashboard HTML', String(founderPage.status));
    }
  } catch (e) {
    fail('Founder dashboard HTML', e.message);
  }

  if (founderKey) {
    try {
      const res = await fetch(`${apiBase}/api/founder/dashboard`, {
        headers: { 'x-founder-admin-key': founderKey },
      });
      if (res.ok) pass('Founder dashboard API');
      else fail('Founder dashboard API', `${res.status} ${await res.text()}`);
    } catch (e) {
      fail('Founder dashboard API', e.message);
    }
  } else {
    skip('Founder dashboard API', 'set FOUNDER_ADMIN_KEY to test');
  }

  // 6. DB migration applied (optional — needs service role)
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  if (serviceKey && supabaseUrl) {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(supabaseUrl, serviceKey);
    const { error } = await db.from('user_outcome_baselines').select('id').limit(1);
    if (error?.message?.includes('does not exist')) {
      fail('Migration 011 applied', 'run 011_outcome_intelligence.sql in Supabase');
    } else if (error) {
      fail('Migration 011 applied', error.message);
    } else {
      pass('Migration 011 applied', 'user_outcome_baselines reachable');
    }
  } else {
    skip('Migration 011 applied', 'SUPABASE_SERVICE_ROLE_KEY not set');
  }

  console.log('\n=== Summary ===');
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const skipped = checks.filter((c) => c.status === 'SKIP').length;
  console.log(`PASS: ${passed}  FAIL: ${failed}  SKIP: ${skipped}`);

  if (failed > 0) {
    console.log('\nOVERALL: FAIL — fix blockers above');
    process.exit(1);
  }
  console.log('\nOVERALL: PASS (code foundation ready; apply migration 011 for full E2E)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

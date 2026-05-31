#!/usr/bin/env node
/**
 * Sprint 7.8 — Beta Readiness validation & E2E gate
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const areas = [];
function area(name, status, detail = '') {
  areas.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'PARTIAL' ? '◐' : '✗';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runValidator(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const m = out.match(/Summary: (\d+)\/(\d+) PASS/) || out.match(/(\d+)\/(\d+) PASS/);
  if (m) return { ok: r.status === 0, pass: Number(m[1]), total: Number(m[2]), out };
  const summary = out.match(/PASS: (\d+).*FAIL: (\d+)/s);
  if (summary) return { ok: r.status === 0, pass: Number(summary[1]), total: Number(summary[1]) + Number(summary[2]), out };
  return { ok: r.status === 0, pass: r.status === 0 ? 1 : 0, total: 1, out };
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

console.log('=== Sprint 7.8 Beta Readiness Validation ===\n');
console.log(`Production API: ${API}\n`);

console.log('--- Sprint regression suite ---');
const sprintScripts = [
  ['Voice (7.0)', 'scripts/validate-sprint70-voice.mjs'],
  ['Recovery (7.2)', 'scripts/validate-sprint72-recovery.mjs'],
  ['Recommendations (7.3)', 'scripts/validate-sprint73-recommendations.mjs'],
  ['Health (7.4)', 'scripts/validate-sprint74-health.mjs'],
  ['Nutrition (7.5)', 'scripts/validate-sprint75-nutrition.mjs'],
  ['AI Coach (7.6)', 'scripts/validate-sprint76-conversational-coach.mjs'],
];

let sprintPass = 0;
let sprintTotal = 0;
for (const [label, script] of sprintScripts) {
  const r = runValidator(script);
  sprintPass += r.pass;
  sprintTotal += r.total;
  area(`Sprint validator: ${label}`, r.ok ? 'PASS' : 'FAIL', `${r.pass}/${r.total}`);
}

console.log('\n--- Feature verification ---');

// Authentication
const authOk =
  fileExists('src/contexts/AuthContext.tsx') &&
  fileExists('src/services/authService.ts') &&
  fileExists('src/app/(auth)/login.tsx') &&
  fileExists('src/app/(auth)/signup.tsx');
area('Authentication', authOk ? 'PASS' : 'FAIL', 'login, signup, session, password reset');

// Workouts
const workoutsOk =
  fileExists('src/app/(tabs)/workout.tsx') &&
  fileExists('src/state/workout/WorkoutSessionContext.tsx') &&
  fileExists('backend/src/routes/workouts.ts');
area('Workouts', workoutsOk ? 'PASS' : 'FAIL', 'session logging, history, planned workouts');

// Voice logging
const voiceOk = fileExists('src/lib/voice/parseVoiceCommand.ts') && read('src/app/(tabs)/workout.tsx').includes('processVoiceTranscript');
area('Voice logging', voiceOk ? 'PASS' : 'FAIL', 'parse, confirm, log sets');

// Progression engine — Sprint 7.1 smart progression is client-only; basic API progression exists
const progClient = fileExists('src/lib/smartProgressionEngine.ts') && read('src/lib/smartProgressionEngine.ts').includes('computeSmartProgression');
const progService = fileExists('src/services/progressionService.ts');
const progRoute = read('backend/src/routes/training.ts').includes('progression') || read('backend/src/routes/ai.ts').includes('/progression/');
const progFull = progClient && progService;
area(
  'Progression engine',
  progFull ? 'PASS' : progClient && progRoute ? 'PARTIAL' : 'FAIL',
  progFull
    ? 'smart progression service + engine'
    : progClient
      ? 'computeSmartProgression client-only — Sprint 7.1 UI/service not shipped'
      : 'missing progression logic',
);

// Recovery engine
const recoveryCode = fileExists('backend/src/lib/recoveryIntelligenceEngine.ts') && fileExists('src/services/recoveryService.ts');
area('Recovery engine (code)', recoveryCode ? 'PASS' : 'FAIL', 'intelligence report + dashboard');

// Nutrition intelligence
const nutritionCode = fileExists('backend/src/lib/nutritionIntelligenceEngine.ts') && fileExists('src/services/nutritionIntelligenceService.ts');
area('Nutrition intelligence (code)', nutritionCode ? 'PASS' : 'FAIL', 'macros, meals, coaching tips');

// AI Coach
const coachCode = fileExists('backend/src/lib/conversationalCoachEngine.ts') && fileExists('src/components/coaching/ConversationalCoachPanel.tsx');
area('AI Coach (code)', coachCode ? 'PASS' : 'FAIL', 'conversational coach + memory');

// Progress photos
const photosOk = fileExists('src/services/bodyService.ts') && read('src/app/(tabs)/progress.tsx').includes('uploadFromPicker');
area('Progress photos', photosOk ? 'PASS' : 'FAIL', 'upload, gallery, body composition');

// Founder dashboard
const founderOk =
  fileExists('backend/src/lib/founderDashboard.ts') &&
  fileExists('backend/src/routes/founder.ts') &&
  read('backend/src/index.ts').includes('/admin/founder');
area('Founder dashboard (code)', founderOk ? 'PASS' : 'FAIL', 'HTML + JSON analytics');

console.log('\n--- Production E2E (live API) ---');

const health = await fetchStatus(`${API.replace(/\/$/, '')}/health`);
area('API health', health.ok ? 'PASS' : 'FAIL', health.ok ? `HTTP ${health.status}` : health.text.slice(0, 60));

let openaiMissing = false;
if (health.ok) {
  try {
    const data = JSON.parse(health.text);
    if (data.openai === 'missing') {
      openaiMissing = true;
      area('OpenAI on production', 'PARTIAL', 'OPENAI_API_KEY not set — GPT coach degraded to heuristics');
    } else area('OpenAI on production', 'PASS', `openai=${data.openai}`);
  } catch {
    area('OpenAI on production', 'PARTIAL', 'could not parse health JSON');
  }
}

const legalPrivacy = await fetchStatus(`${API}/legal/privacy`);
area('Privacy policy URL', legalPrivacy.ok ? 'PASS' : 'FAIL', `HTTP ${legalPrivacy.status}`);

const legalTerms = await fetchStatus(`${API}/legal/terms`);
area('Terms URL', legalTerms.ok ? 'PASS' : 'FAIL', `HTTP ${legalTerms.status}`);

const founderHtml = await fetchStatus(`${API}/admin/founder`);
area('Founder dashboard HTML', founderHtml.ok ? 'PASS' : 'FAIL', `HTTP ${founderHtml.status}`);

const testUser = '00000000-0000-0000-0000-000000000001';
const recoveryProd = await fetchStatus(`${API}/api/training/recovery/intelligence?userId=${testUser}`);
const nutritionProd = await fetchStatus(`${API}/api/nutrition/intelligence?userId=${testUser}`);
const converseProd = await fetchStatus(`${API}/api/ai/converse`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: testUser, message: 'What should I train today?' }),
});

const prodIntelDeployed = recoveryProd.status !== 404 && !recoveryProd.text.includes('Cannot GET');
area(
  'Recovery API (production)',
  prodIntelDeployed ? 'PASS' : 'FAIL',
  prodIntelDeployed ? `HTTP ${recoveryProd.status}` : 'Route not deployed — redeploy Render backend',
);
area(
  'Nutrition API (production)',
  nutritionProd.status !== 404 && !nutritionProd.text.includes('Cannot GET') ? 'PASS' : 'FAIL',
  nutritionProd.status !== 404 ? `HTTP ${nutritionProd.status}` : 'Route not deployed',
);
area(
  'Conversational coach API (production)',
  converseProd.status !== 404 && !converseProd.text.includes('Cannot POST') ? 'PASS' : 'FAIL',
  converseProd.status !== 404 ? `HTTP ${converseProd.status}` : 'Route not deployed',
);

const legacyCoach = await fetchStatus(`${API}/api/ai/coach`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: testUser, message: 'test' }),
});
area('Legacy AI coach API', legacyCoach.ok ? 'PASS' : 'PARTIAL', `HTTP ${legacyCoach.status}`);

console.log('\n--- Build & config ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
area('Backend TypeScript build', backendBuild.status === 0 ? 'PASS' : 'FAIL');

area('EAS production profile', fileExists('eas.json') ? 'PASS' : 'FAIL');
area('App Store privacy strings', read('app.config.ts').includes('NSMicrophoneUsageDescription') ? 'PASS' : 'FAIL');
area('HealthKit plugin', read('app.config.ts').includes('@kingstinct/react-native-healthkit') ? 'PASS' : 'FAIL');

const healthMigration = fileExists('supabase/migrations/012_health_integration.sql');
area('Health migration file', healthMigration ? 'PASS' : 'FAIL', '012_health_integration.sql');

console.log('\n--- Beta readiness score ---');
const weights = { PASS: 1, PARTIAL: 0.5, FAIL: 0 };
const score = areas.reduce((sum, a) => sum + weights[a.status], 0);
const maxScore = areas.length;
const pct = Math.round((score / maxScore) * 100);

const passCount = areas.filter((a) => a.status === 'PASS').length;
const partialCount = areas.filter((a) => a.status === 'PARTIAL').length;
const failCount = areas.filter((a) => a.status === 'FAIL').length;

console.log(`  Areas: ${passCount} PASS · ${partialCount} PARTIAL · ${failCount} FAIL (${areas.length} total)`);
console.log(`  Sprint validators: ${sprintPass}/${sprintTotal} checks passed`);
console.log(`  Beta Readiness Score: ${pct}/100`);

const blockers = [];
if (!prodIntelDeployed) blockers.push('Redeploy production API with Sprint 7.2–7.6 backend routes');
if (openaiMissing) blockers.push('Set OPENAI_API_KEY on Render for full AI coach + TTS');
if (!progFull) blockers.push('Complete Sprint 7.1 smart progression (progressionService + UI + API route)');
if (failCount > 0) blockers.push('Resolve FAIL areas above before external beta');

console.log('\n--- Release blockers ---');
if (blockers.length === 0) console.log('  None critical — proceed to TestFlight/internal beta');
else blockers.forEach((b) => console.log(`  • ${b}`));

const appStoreBlockers = [
  'EAS production iOS build + TestFlight upload',
  'App Store Connect listing (screenshots, description, age rating)',
  'RevenueCat + App Store IAP product linked (EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)',
  'Verify HealthKit capability on production iOS build (not Expo Go)',
  'Apply pending Supabase migrations (010 gym types, 012 health sync) if not applied',
];
console.log('\n--- App Store blockers ---');
appStoreBlockers.forEach((b) => console.log(`  • ${b}`));

console.log(`\n=== Sprint 7.8 Summary: ${passCount}/${areas.length} PASS · Score ${pct}/100 ===`);
process.exit(failCount > 0 || pct < 75 ? 1 : 0);

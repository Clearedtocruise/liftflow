#!/usr/bin/env node
/**
 * Sprint 7.6 — Conversational AI Coach validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 7.6 Conversational AI Coach Validation ===\n');

const requiredFiles = [
  'backend/src/lib/conversationalCoachEngine.ts',
  'backend/src/lib/loadConversationalCoachContext.ts',
  'backend/src/lib/coachMemory.ts',
  'src/types/conversationalCoach.ts',
  'src/services/conversationalCoachService.ts',
  'src/components/coaching/ConversationalCoachPanel.tsx',
  'src/app/(features)/coach-chat.tsx',
];

for (const f of requiredFiles) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing file', f);
}

const engine = read('backend/src/lib/conversationalCoachEngine.ts');
const loader = read('backend/src/lib/loadConversationalCoachContext.ts');
const memory = read('backend/src/lib/coachMemory.ts');

for (const token of [
  'converseWithCoach',
  'shortAnswer',
  'detailedAnswer',
  'voiceLine',
  'train_today',
  'stalled',
  'lift_weight',
  'fatigued',
  'referencesUsed',
  'suggestedFollowUps',
  'memorySummary',
]) {
  if (engine.includes(token)) pass('Engine', token);
  else fail('Engine missing', token);
}

for (const src of [
  'loadRecoveryIntelligence',
  'loadWorkoutRecommendations',
  'loadNutritionIntelligence',
  'getUserOutcomeSummary',
  'progress_photos',
  'loadCoachMemory',
]) {
  if (loader.includes(src)) pass('Context source', src);
  else fail('Context source missing', src);
}

if (memory.includes('classifyCoachTopic') && memory.includes('loadCoachMemory') && memory.includes('saveCoachTurn')) {
  pass('Memory management');
} else fail('Memory management');

const route = read('backend/src/routes/ai.ts');
if (route.includes('/converse') && route.includes('/converse/history')) pass('API routes');
else fail('API routes');

const voice = read('src/lib/voice/parseVoiceCommand.ts');
if (voice.includes('coach_query')) pass('Voice intent coach_query');
else fail('Voice intent');

const workout = read('src/app/(tabs)/workout.tsx');
if (workout.includes('conversationalCoachService') && workout.includes('coach_query')) pass('Workout voice wiring');
else fail('Workout voice wiring');

const coaching = read('src/app/(tabs)/coaching.tsx');
if (coaching.includes('ConversationalCoachPanel') && coaching.includes('conversationalCoachService')) {
  pass('Coaching tab integration');
} else fail('Coaching tab integration');

const panel = read('src/components/coaching/ConversationalCoachPanel.tsx');
if (panel.includes('short') && panel.includes('detailed') && panel.includes('voice') && panel.includes('COACH_STARTER_QUESTIONS')) {
  pass('Short/detailed/voice UI');
} else fail('Answer modes UI');

const types = read('src/types/conversationalCoach.ts');
for (const q of [
  'What should I train today?',
  'Why am I stalled?',
  'How much should I lift?',
  'What should I eat?',
  'Why am I fatigued?',
  'How much protein should I consume?',
]) {
  if (types.includes(q)) pass('Starter question', q.slice(0, 28));
  else fail('Starter question missing', q);
}

console.log('\n--- Unit tests ---');
const unit = spawnSync('node', ['scripts/test-conversational-coach.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(unit.stdout ?? '');
if (unit.stderr) process.stderr.write(unit.stderr);
if (unit.status === 0) pass('Unit tests — all passed');
else fail('Unit tests');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.6 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * Sprint 7.6 — Conversational Coach unit tests
 */

function classifyCoachTopic(message) {
  const q = message.toLowerCase().trim();
  if (/what\s+should\s+i\s+train|train\s+today/.test(q)) return 'train_today';
  if (/stalled|plateau/.test(q)) return 'stalled';
  if (/how\s+much\s+should\s+i\s+lift|what\s+weight/.test(q)) return 'lift_weight';
  if (/what\s+should\s+i\s+eat/.test(q) && !/protein/.test(q)) return 'eat';
  if (/fatigue|fatigued|tired/.test(q)) return 'fatigued';
  if (/how\s+much\s+protein/.test(q)) return 'protein';
  return 'general';
}

function pickAnswer(level, short, detailed, voice) {
  if (level === 'short') return short;
  if (level === 'voice') return voice;
  return detailed;
}

function buildMemorySummary(turns) {
  if (turns.length === 0) return 'No prior coach conversations in this session window.';
  const topics = [...new Set(turns.map((t) => t.topic))];
  return `Recent topics: ${topics.join(', ')}.`;
}

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

console.log('=== Conversational Coach Tests ===\n');

if (classifyCoachTopic('What should I train today?') === 'train_today') pass('Topic — train today');
else fail('Topic — train today');

if (classifyCoachTopic('Why am I stalled?') === 'stalled') pass('Topic — stalled');
else fail('Topic — stalled');

if (classifyCoachTopic('How much should I lift?') === 'lift_weight') pass('Topic — lift weight');
else fail('Topic — lift weight');

if (classifyCoachTopic('What should I eat?') === 'eat') pass('Topic — eat');
else fail('Topic — eat');

if (classifyCoachTopic('Why am I fatigued?') === 'fatigued') pass('Topic — fatigued');
else fail('Topic — fatigued');

if (classifyCoachTopic('How much protein should I consume?') === 'protein') pass('Topic — protein');
else fail('Topic — protein');

if (pickAnswer('short', 'A', 'B', 'C') === 'A') pass('Short answer mode');
else fail('Short answer mode');

if (pickAnswer('detailed', 'A', 'B', 'C') === 'B') pass('Detailed answer mode');
else fail('Detailed answer mode');

if (pickAnswer('voice', 'A', 'B', 'C') === 'C') pass('Voice answer mode');
else fail('Voice answer mode');

const summary = buildMemorySummary([
  { topic: 'train_today' },
  { topic: 'protein' },
]);
if (summary.includes('train_today') && summary.includes('protein')) pass('Memory summary');
else fail('Memory summary');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

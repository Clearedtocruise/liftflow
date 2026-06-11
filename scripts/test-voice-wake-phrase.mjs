#!/usr/bin/env node
/**
 * Wake phrase + voice command smoke tests (no device mic required).
 */

const WAKE_PREFIXES = [
  /^(hey\s+)?one\s+more[,.]?\s*/i,
  /^log\s+(?:the\s+)?set[,.]?\s*/i,
  /^ok\s+one\s+more[,.]?\s*/i,
];

const WAKE_ONLY = [
  /^(?:hey\s+)?one\s+more[,.]?\s*$/i,
  /^log\s+(?:the\s+)?set[,.]?\s*$/i,
  /^ok\s+one\s+more[,.]?\s*$/i,
];

function parseWakePhrase(text) {
  const trimmed = text.trim();
  if (!trimmed) return { hasWake: false, isWakeOnly: false, command: '' };

  for (let i = 0; i < WAKE_PREFIXES.length; i++) {
    const prefix = WAKE_PREFIXES[i];
    const only = WAKE_ONLY[i];
    if (prefix.test(trimmed)) {
      const command = trimmed.replace(prefix, '').trim();
      return {
        hasWake: true,
        isWakeOnly: only.test(trimmed) || command.length === 0,
        command,
      };
    }
  }

  return { hasWake: false, isWakeOnly: false, command: trimmed };
}

function simulateWakeFlow(utterances) {
  let armed = false;
  const commands = [];

  for (const { text, isFinal } of utterances) {
    const parsed = parseWakePhrase(text);
    if (armed) {
      if (!isFinal) continue;
      if (parsed.isWakeOnly) continue;
      commands.push(parsed.command || text.trim());
      armed = false;
      continue;
    }
    if (!parsed.hasWake) continue;
    if (parsed.isWakeOnly) {
      if (isFinal) armed = true;
      continue;
    }
    if (isFinal) commands.push(parsed.command);
  }

  return commands;
}

const wakeCases = [
  ['one more', { hasWake: true, isWakeOnly: true, command: '' }],
  ['Hey one more', { hasWake: true, isWakeOnly: true, command: '' }],
  ['log set', { hasWake: true, isWakeOnly: true, command: '' }],
  ['log the set', { hasWake: true, isWakeOnly: true, command: '' }],
  [
    'one more bench press 225 for 8',
    { hasWake: true, isWakeOnly: false, command: 'bench press 225 for 8' },
  ],
  [
    'log set squat 315 for 5',
    { hasWake: true, isWakeOnly: false, command: 'squat 315 for 5' },
  ],
  ['bench press 225 for 8', { hasWake: false, isWakeOnly: false, command: 'bench press 225 for 8' }],
  ['', { hasWake: false, isWakeOnly: false, command: '' }],
];

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  PASS — ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  FAIL — ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('=== Wake phrase parser ===\n');
for (const [input, expected] of wakeCases) {
  const got = parseWakePhrase(input);
  const match =
    got.hasWake === expected.hasWake &&
    got.isWakeOnly === expected.isWakeOnly &&
    got.command === expected.command;
  if (match) ok(`parseWakePhrase("${input}")`);
  else fail(`parseWakePhrase("${input}")`, `got ${JSON.stringify(got)}`);
}

console.log('\n=== Wake phrase flow (two-step) ===\n');
const twoStep = simulateWakeFlow([
  { text: 'one more', isFinal: true },
  { text: 'bench press 225 for 8', isFinal: true },
]);
if (twoStep.length === 1 && twoStep[0] === 'bench press 225 for 8') {
  ok('two-step: one more → set command');
} else {
  fail('two-step: one more → set command', JSON.stringify(twoStep));
}

const oneShot = simulateWakeFlow([
  { text: 'log set deadlift 405 for 3', isFinal: true },
]);
if (oneShot.length === 1 && oneShot[0] === 'deadlift 405 for 3') {
  ok('one-shot: log set + command');
} else {
  fail('one-shot: log set + command', JSON.stringify(oneShot));
}

const ignored = simulateWakeFlow([{ text: 'starting set now', isFinal: true }]);
if (ignored.length === 0) ok('ignores speech without wake phrase');
else fail('ignores speech without wake phrase', JSON.stringify(ignored));

console.log(`\n${failed === 0 ? 'ALL PASSED' : 'FAILED'} (${passed}/${passed + failed})\n`);
process.exit(failed > 0 ? 1 : 0);

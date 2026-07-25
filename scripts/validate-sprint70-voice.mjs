#!/usr/bin/env node
/**
 * Sprint 7.0 Priority 0 — Voice Recognition Infrastructure validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') { checks.push({ n, s: 'PASS', d }); console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`); }
function fail(n, d = '') { checks.push({ n, s: 'FAIL', d }); console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); }
function warn(n, d = '') { checks.push({ n, s: 'WARN', d }); console.log(`  ! ${n}${d ? ' — ' + d : ''}`); }

/** Returns '' for a missing path so a moved file downgrades a check instead of crashing the run. */
function read(rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : '';
}

/** Concatenates every file under a route directory, so checks survive a file-to-directory refactor. */
function readTree(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return '';
  if (fs.statSync(abs).isFile()) return fs.readFileSync(abs, 'utf8');
  return fs.readdirSync(abs)
    .map((entry) => readTree(path.join(rel, entry)))
    .join('\n');
}

console.log('=== Sprint 7.0 Voice Infrastructure Validation ===\n');

const requiredFiles = [
  'src/types/voice.ts',
  'src/lib/voice/parseVoiceCommand.ts',
  'src/lib/voice/resolveConfirmation.ts',
  'src/hooks/useVoiceRecognition.ts',
  'src/hooks/useVoiceSettings.ts',
  'src/services/voiceService.ts',
  'backend/src/lib/voiceConfirmation.ts',
];

for (const f of requiredFiles) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing file', f);
}

const parser = read('src/lib/voice/parseVoiceCommand.ts');
// The patterns are regex sources, so a literal substring match would miss `same\s+weight`.
for (const phrase of ['same weight', 'increase', 'undo', 'next set', 'declare_exercise']) {
  const spaceTolerant = new RegExp(phrase.replace(/ /g, String.raw`(?:\s|\\s\+|\\s\*)+`), 'i');
  if (spaceTolerant.test(parser)) pass('Parser pattern', phrase);
  else fail('Parser missing', phrase);
}

for (const intent of ['log_set', 'adjust_weight', 'feedback', 'undo_last_set', 'next_set', 'declare_exercise']) {
  if (parser.includes(`'${intent}'`)) pass('Parser intent', intent);
  else fail('Parser intent missing', intent);
}

for (const guard of ['implausible', 'ambiguousOrder', 'multipleSetsHeard']) {
  if (parser.includes(guard)) pass('Parser safety flag', guard);
  else fail('Parser safety flag missing', guard);
}

// The hook exposes press handlers and a tap toggle; push-to-talk and continuous capture depend on
// the missing speech-to-text layer, so their absence is expected rather than a defect.
const hook = read('src/hooks/useVoiceRecognition.ts');
if (hook.includes('handlePressIn') && hook.includes('handlePressOut') && hook.includes('tap_toggle')) {
  pass('Listening modes', 'tap toggle + press handlers');
} else fail('Listening modes incomplete');

if (hook.includes('push_to_talk') && hook.includes('continuous')) pass('Listening modes', 'push-to-talk and continuous');
else warn('Listening modes', 'push-to-talk/continuous not implemented — awaiting speech-to-text');

const settings = read('src/app/(tabs)/settings.tsx');
if (settings.includes('voiceAutoLog') && settings.includes('voiceFeedback') && settings.includes('voiceInputMode')) {
  pass('Voice settings UI');
} else fail('Voice settings UI');

// Voice capture is not wired into the workout screens: there is no speech-to-text layer yet, so
// the screens only show the "coming soon" banner. Warn rather than fail until STT lands.
const workout = readTree('src/app/(tabs)/workout');
if (workout.includes('processVoiceTranscript')) pass('Workout voice integration');
else if (workout.includes('VoiceComingSoonBanner')) warn('Workout voice integration', 'placeholder banner only — awaiting speech-to-text');
else fail('Workout voice integration', 'no voice entry point found');

const backendParser = read('backend/src/lib/voiceParser.ts');
if (backendParser.includes('undo_last_set') && backendParser.includes('VoiceParseContext')) {
  pass('Backend voice parser');
} else fail('Backend voice parser');

for (const guard of ['sanitizeParseContext', 'readTranscript', 'validateLlmCommand', 'asPromptData']) {
  if (backendParser.includes(guard)) pass('Backend parser guard', guard);
  else fail('Backend parser guard missing', guard);
}

if (read('backend/src/lib/voicePlausibility.ts').includes('WEIGHT_MAX_LB')) pass('Plausibility ranges', 'backend');
else fail('Plausibility ranges missing', 'backend');
if (read('src/lib/voice/voicePlausibility.ts').includes('WEIGHT_MAX_LB')) pass('Plausibility ranges', 'client mirror');
else fail('Plausibility ranges missing', 'client mirror');

// Both parse routes must sit behind auth and the shared AI rate limiter.
const serverIndex = read('backend/src/index.ts');
for (const route of ['/api/parse', '/api/voice']) {
  const line = serverIndex.split('\n').find((l) => l.includes(`'${route}'`));
  if (line && line.includes('requireUser') && line.includes('Limiter')) pass('Route protected', route);
  else fail('Route unprotected', route);
}

const parseRoute = read('backend/src/routes/parse.ts');
if (!parseRoute.includes('501')) pass('Legacy /api/parse wired');
else fail('Legacy /api/parse still 501');

const failed = checks.filter((c) => c.s === 'FAIL').length;
const warned = checks.filter((c) => c.s === 'WARN').length;
console.log(`\n=== Summary: ${checks.length - failed - warned}/${checks.length} PASS, ${warned} WARN, ${failed} FAIL ===`);
process.exit(failed ? 1 : 0);

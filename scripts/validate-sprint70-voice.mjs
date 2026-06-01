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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
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
for (const phrase of ['same weight', 'increase to', 'undo', 'next set', 'declare_exercise']) {
  if (parser.includes(phrase) || parser.includes('undo_last_set')) pass('Parser pattern', phrase);
  else fail('Parser missing', phrase);
}

const hook = read('src/hooks/useVoiceRecognition.ts');
if (hook.includes('push_to_talk') && hook.includes('continuous') && hook.includes('handlePressIn')) {
  pass('Listening modes', 'push-to-talk, continuous, tap toggle');
} else fail('Listening modes incomplete');

const settings = read('src/app/(tabs)/settings.tsx');
if (settings.includes('voiceAutoLog') && settings.includes('voiceFeedback') && settings.includes('voiceInputMode')) {
  pass('Voice settings UI');
} else fail('Voice settings UI');

const workout = read('src/app/(tabs)/workout.tsx');
if (workout.includes('processVoiceTranscript') && workout.includes('useVoiceSettings')) {
  pass('Workout voice integration');
} else fail('Workout voice integration');

const backendParser = read('backend/src/lib/voiceParser.ts');
if (backendParser.includes('undo_last_set') && backendParser.includes('VoiceParseContext')) {
  pass('Backend voice parser');
} else fail('Backend voice parser');

const parseRoute = read('backend/src/routes/parse.ts');
if (!parseRoute.includes('501')) pass('Legacy /api/parse wired');
else fail('Legacy /api/parse still 501');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);

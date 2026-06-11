#!/usr/bin/env node
/**
 * Verifies voice architecture: no direct expo-speech-recognition imports outside speechRecognitionService.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1;
  else fail += 1;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
check('expo-speech-recognition in package.json', Boolean(pkg.dependencies?.['expo-speech-recognition']));

const appConfig = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
check('expo-speech-recognition in app.config plugins', appConfig.includes('expo-speech-recognition'));

const directImports = [];
for (const file of walk(src)) {
  if (file.includes('speechRecognitionService')) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes("from 'expo-speech-recognition'") || text.includes('from "expo-speech-recognition"')) {
    directImports.push(path.relative(root, file));
  }
}
check('No direct expo-speech-recognition imports outside speechRecognitionService', directImports.length === 0, directImports.join(', ') || 'none');

const noLazy = !walk(src).some((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return t.includes('React.lazy') || t.includes('lazy(');
});
check('No React.lazy in src', noLazy);

const workoutControls = fs.readFileSync(path.join(src, 'components/workout/WorkoutVoiceControls.tsx'), 'utf8');
check('WorkoutVoiceControls checks isSpeechModuleAvailable', workoutControls.includes('isSpeechModuleAvailable'));

const nutritionMic = fs.readFileSync(path.join(src, 'components/nutrition/NutritionVoiceMic.tsx'), 'utf8');
check('NutritionVoiceMic checks isSpeechModuleAvailable', nutritionMic.includes('isSpeechModuleAvailable'));

const liveHook = fs.readFileSync(path.join(src, 'hooks/useVoiceRecognitionLive.native.ts'), 'utf8');
check('useVoiceRecognitionLive uses speechRecognitionService', liveHook.includes('speechRecognitionService'));
check(
  'useVoiceRecognitionLive avoids expo-speech-recognition import',
  !/^import\s+.*expo-speech-recognition/m.test(liveHook),
);

console.log(`\nVoice architecture checks: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass}/${pass + fail})\n`);
process.exit(fail === 0 ? 0 : 1);

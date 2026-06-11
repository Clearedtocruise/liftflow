#!/usr/bin/env node
/**
 * Validates stabilization fixes: baseline workouts, exercise resolution, voice hooks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1;
  else fail += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const baselineSrc = read('src/constants/freeBaselineWorkouts.ts');
const workoutBlocks = baselineSrc.match(/exercises:\s*\[[\s\S]*?\],/g) ?? [];
check('Free baseline workouts defined', workoutBlocks.length === 3, `count=${workoutBlocks.length}`);
for (const block of workoutBlocks) {
  const names = [...block.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  check('Baseline block has 10 exercises', names.length === 10, `got ${names.length}`);
}

check('exerciseResolution.ts exists', fs.existsSync(path.join(root, 'src/lib/exerciseResolution.ts')));
const resolutionSrc = read('src/lib/exerciseResolution.ts');
check('inferMovementCategory exported', resolutionSrc.includes('export function inferMovementCategory'));
check('resolveExerciseSlug exported', resolutionSrc.includes('export function resolveExerciseSlug'));
check('No invalid custom category in workoutService', !read('src/services/workoutService.ts').includes("category: 'custom'"));

const voiceNative = read('src/hooks/useVoiceRecognition.native.ts');
check('Voice uses useSpeechRecognitionEvent', voiceNative.includes('useSpeechRecognitionEvent'));
check('Voice uses continuous false', voiceNative.includes('continuous: false'));
check('No addListener churn in native hook', !voiceNative.includes('addListener'));

const nutritionMic = read('src/components/nutrition/NutritionVoiceMic.tsx');
check('Nutrition mic uses tap_toggle', nutritionMic.includes("inputMode: 'tap_toggle'"));
check('Nutrition hint not log a set', nutritionMic.includes('log food') || nutritionMic.includes('NUTRITION_MIC_HINT'));

const micBtn = read('src/components/workout/MicrophoneButton.tsx');
check('Tap toggle hint updated', micBtn.includes('Tap to speak'));

const eas = read('eas.json');
check('TestFlight unlock env', eas.includes('EXPO_PUBLIC_TESTFLIGHT_UNLOCK'));

console.log(`\nStabilization checks: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass}/${pass + fail})\n`);
process.exit(fail === 0 ? 0 : 1);

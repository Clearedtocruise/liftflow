/**
 * Guards voice set logging: which spoken exercise names count as the exercise on screen, and that
 * a refusal can always say why.
 *
 * Usage: npm run validate:voice-logging
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { matchSpokenExercise } from '@/lib/voice/matchSpokenExercise';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

function kind(spoken: string, active: string): string {
  return matchSpokenExercise(spoken, active).kind;
}

const repoRoot = join(__dirname, '..');
function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

console.log('\nThe reported failure: an abbreviated name is the exercise on screen');
// "bench press 225 for 8" against "Barbell Bench Press" used to fail a strict equality check and
// surface as "Could not save that set. Try logging it manually."
check('bench press / Barbell Bench Press', kind('bench press', 'Barbell Bench Press'), 'exact');
check('curl / Dumbbell Curl', kind('curl', 'Dumbbell Curl'), 'exact');
check('lat pulldown / Cable Lat Pulldown', kind('lat pulldown', 'Cable Lat Pulldown'), 'exact');
check('leg press / Machine Leg Press', kind('leg press', 'Machine Leg Press'), 'exact');
check('RDL / Barbell Romanian Deadlift', kind('RDL', 'Barbell Romanian Deadlift'), 'exact');
check('OHP / Overhead Press', kind('OHP', 'Overhead Press'), 'exact');
check('DB shoulder press / Dumbbell Shoulder Press', kind('DB shoulder press', 'Dumbbell Shoulder Press'), 'exact');

console.log('\nTranscription spelling and plurals do not change the exercise');
check('bench press. / Bench Press', kind('bench press.', 'Bench Press'), 'exact');
check('dumbbell curls / Dumbbell Curl', kind('dumbbell curls', 'Dumbbell Curl'), 'exact');
check('cable flyes / Cable Fly', kind('cable flyes', 'Cable Fly'), 'exact');
check('lat pull down / Lat Pulldown', kind('lat pull down', 'Lat Pulldown'), 'exact');
check('pull ups / Pull Up', kind('pull ups', 'Pull Up'), 'exact');
check('tricep pushdown / Tricep Pressdown', kind('tricep pushdown', 'Tricep Pressdown'), 'exact');
check('face pull / Facepull', kind('face pull', 'Facepull'), 'exact');

console.log('\nA name shortened past the catalog spelling still logs, and is reported as related');
check('squat / Barbell Back Squat', kind('squat', 'Barbell Back Squat'), 'related');
check('bench press / Incline Bench Press', kind('bench press', 'Incline Bench Press'), 'related');
check('row / Seated Cable Row', kind('row', 'Seated Cable Row'), 'related');
check('barbell bench press / Bench Press', kind('barbell bench press', 'Bench Press'), 'exact');

console.log('\nA different exercise is refused, with a reason naming both');
check('bench press / Leg Press', kind('bench press', 'Leg Press'), 'different');
check('squat / Bench Press', kind('squat', 'Bench Press'), 'different');
check('lat pulldown / Bench Press', kind('lat pulldown', 'Bench Press'), 'different');
check('deadlift / Romanian Deadlift is not a conflict', kind('deadlift', 'Romanian Deadlift'), 'related');
check('romanian deadlift / Sumo Deadlift', kind('romanian deadlift', 'Sumo Deadlift'), 'different');
check('incline bench press / Decline Bench Press', kind('incline bench press', 'Decline Bench Press'), 'different');
check('front squat / Back Squat', kind('front squat', 'Back Squat'), 'different');
check('seated row / Bent Over Row', kind('seated row', 'Bent Over Row'), 'different');
check('close grip bench press / Wide Grip Bench Press', kind('close grip bench press', 'Wide Grip Bench Press'), 'different');
check('hammer low row / Hammer High Row', kind('hammer low row', 'Hammer High Row'), 'different');
check('reverse lunge / Forward Lunge', kind('reverse lunge', 'Forward Lunge'), 'different');

const mismatch = matchSpokenExercise('leg press', 'Barbell Bench Press');
check('refusal names what was heard', mismatch.kind === 'different' && mismatch.reason.includes('leg press'), true);
check(
  'refusal names the current exercise',
  mismatch.kind === 'different' && mismatch.reason.includes('Barbell Bench Press'),
  true,
);

console.log('\nAn implement-only name does not collapse to a wildcard');
check('kettlebell / Kettlebell Swing', kind('kettlebell', 'Kettlebell Swing'), 'different');
check('machine / Leg Press', kind('machine', 'Leg Press'), 'different');
check('empty / Bench Press', kind('   ', 'Bench Press'), 'different');

console.log('\nThe screen surfaces the real reason instead of a single generic caption');
const activeWorkout = source('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const logger = source('src/components/workout/VoiceSetLogger.tsx');

check(
  'the active-workout handler no longer compares names for equality',
  /payload\.exerciseName\.trim\(\)\.toLowerCase\(\)\s*!==/.test(activeWorkout),
  false,
);
check(
  'the active-workout handler matches names through matchSpokenExercise',
  activeWorkout.includes('matchSpokenExercise(payload.exerciseName, activeName)'),
  true,
);
check(
  "commitSetLog's reason reaches the caller rather than being dropped to a boolean",
  activeWorkout.includes('return { ok: false, reason: result.error }'),
  true,
);
check(
  'a successful voice log reports the exercise it landed on',
  activeWorkout.includes('return { ok: true, loggedAs: activeName }'),
  true,
);
check(
  'the logger prefers the returned reason over the generic caption',
  logger.includes("result.reason ?? 'Could not save that set. Try logging it manually.'"),
  true,
);
check(
  'spoken confirmation is wired to the voice feedback preference',
  logger.includes('speakVoiceConfirmation(') && logger.includes('settings.voiceFeedback'),
  true,
);

console.log('\nThe microphone gives the lifter their music back');
// Recording forces iOS into PlayAndRecord. Without an explicit duck it interrupts whatever is
// playing, and an interrupted app only resumes on a deactivation flag expo-av does not expose —
// so the music stopped when the mic opened and never returned.
const audioSession = source('src/lib/voice/audioSession.ts');
const recordAudio = source('src/lib/voice/recordAudio.ts');
const coachSpeech = source('src/services/voiceCoachingService.ts');

check('capture ducks other audio rather than interrupting it', audioSession.includes('InterruptionModeIOS.DuckOthers'), true);
check('Android ducks too', audioSession.includes('InterruptionModeAndroid.DuckOthers'), true);
check('releasing hands playback back to other apps', audioSession.includes('InterruptionModeIOS.MixWithOthers'), true);
check('releasing turns recording off so audio leaves the earpiece', audioSession.includes('allowsRecordingIOS: false'), true);
check('the session is never held into the background', audioSession.includes('staysActiveInBackground: false'), true);

console.log('\nEvery path out of recording releases the session');
check('stopping releases it', recordAudio.includes('await releaseAudioSession()'), true);
check('a recorder that fails to open releases it', recordAudio.includes('await releaseAudioSession();\n    throw error;'), true);
check('spoken replies release it when they finish', coachSpeech.includes('didJustFinish) void releaseAudioSession()'), true);
check('device Speech fallbacks also release via speakCue', coachSpeech.includes("from '@/lib/voice/speakCue'"), true);

console.log('\nRest-complete and voice confirmations restore music after speaking');
const speakCue = source('src/lib/voice/speakCue.ts');
const restTimer = source('src/state/workout/WorkoutSessionContext.tsx');
const voiceFeedback = source('src/lib/voice/voiceFeedback.ts');
check('speakCue ducks while the cue plays', speakCue.includes('enterVoicePlaybackMode'), true);
check('speakCue releases when speech finishes', speakCue.includes('onDone: finish') && speakCue.includes('releaseAudioSession'), true);
check('rest complete uses speakCue (not bare Speech.speak)', restTimer.includes("speakCue('Rest complete. Ready for your next set.'"), true);
check('rest complete does not call bare Speech.speak', restTimer.includes('Speech.speak'), false);
check('voice confirmations use speakCue', voiceFeedback.includes('speakCue(message'), true);

console.log('\nAudio mode is set in one place, so two callers cannot fight over it');
check('the recorder does not patch the mode itself', recordAudio.includes('setAudioModeAsync'), false);
check('the coach does not patch the mode itself', coachSpeech.includes('setAudioModeAsync'), false);
check('speakCue does not patch the mode itself', speakCue.includes('setAudioModeAsync'), false);

console.log(`\nVoice logging: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);

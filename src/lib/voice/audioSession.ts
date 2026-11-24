import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * The one place the app changes the shared audio session.
 *
 * Gym music must keep playing while the mic is open and while a cue is spoken. On iOS that means
 * the session mixes with other audio and never ducks it: a duck is only undone by whoever asked
 * for it, and one that outlives its phrase leaves the music quiet until the app is left. Android
 * has real audio focus, so it ducks while the mic is open and the cue is spoken.
 *
 * Every call passes a complete mode rather than a patch, because `setAudioModeAsync` merges with
 * whatever was set last and two callers patching different fields is how this drifted.
 */

type VoiceAudioMode = Parameters<typeof setAudioModeAsync>[0];

const PLAYBACK_HANDOFF: VoiceAudioMode = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: 'mixWithOthers',
  shouldRouteThroughEarpiece: false,
};

const ANDROID_DUCKS = Platform.OS === 'android';

/** Mic open: mix on iOS so gym music keeps playing; duck on Android. */
export async function enterVoiceCaptureMode(): Promise<void> {
  await setAudioModeAsync({
    // Must be set before the recorder is prepared or iOS refuses to open the input route.
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: ANDROID_DUCKS ? 'duckOthers' : 'mixWithOthers',
    shouldRouteThroughEarpiece: false,
  });
}

/** Speaking a confirmation: mix on iOS so "Rest complete" does not kill the playlist. */
export async function enterVoicePlaybackMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: ANDROID_DUCKS ? 'duckOthers' : 'mixWithOthers',
    shouldRouteThroughEarpiece: false,
  });
}

/**
 * Leave PlayAndRecord while the recorder (or a just-finished cue) is still alive, so the native
 * category updates before the recorder is torn down.
 */
export async function unduckWhileSessionActive(): Promise<void> {
  await setAudioModeAsync(PLAYBACK_HANDOFF).catch(() => undefined);
}

/**
 * Hands the session back to other apps. Prefer calling {@link unduckWhileSessionActive} first
 * while a recorder/player is still loaded; this is the idle cleanup pass.
 */
export async function releaseAudioSession(): Promise<void> {
  await setAudioModeAsync(PLAYBACK_HANDOFF).catch(() => undefined);
}

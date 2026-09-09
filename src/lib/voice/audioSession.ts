import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * The one place the app changes the shared audio session.
 *
 * Recording forces iOS into the PlayAndRecord category. expo-av maps
 * `InterruptionModeIOS.DuckOthers` to *only* `AVAudioSessionCategoryOptionDuckOthers` — it does
 * not also set MixWithOthers. Apple requires MixWithOthers for ducking to work; without it,
 * PlayAndRecord takes the session exclusively and **stops** Spotify / Apple Music. An interrupted
 * app only resumes when the session is deactivated with `notifyOthersOnDeactivation`, a flag
 * expo-av does not expose — so the track died when the mic (or "Rest complete") opened and
 * never came back.
 *
 * MixWithOthers on iOS keeps other audio playing. Android can still duck.
 *
 * Every call passes a complete mode rather than a patch, because `setAudioModeAsync` merges with
 * whatever was set last and two callers patching different fields is how this drifted.
 *
 * Important: expo-av only applies category changes while it considers the session active. Calling
 * MixWithOthers *after* `stopAndUnloadAsync` (session demoted to Inactive) stores the flag but
 * does not update the hardware session. Call `unduckWhileSessionActive` before unloading the
 * recorder, then `releaseAudioSession`. Do **not** toggle expo-av audio enable off then on —
 * that tears the whole AV subsystem down, stops other apps' music, and leaves the next
 * `Recording.createAsync` failing with a session-busy / recorder-not-prepared error (shown as
 * "Voice is busy" after a retry storm against the transcribe rate limit).
 */

const PLAYBACK_HANDOFF = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
} as const;

/** Mic open: mix on iOS so gym music keeps playing; duck on Android. */
export async function enterVoiceCaptureMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    // Must be set before createAsync or iOS refuses to open the input route.
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/** Speaking a confirmation: mix on iOS so "Rest complete" does not kill the playlist. */
export async function enterVoicePlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * Leave PlayAndRecord while the recorder (or a just-finished cue) still keeps the
 * expo-av session Active so the native category actually updates.
 */
export async function unduckWhileSessionActive(): Promise<void> {
  await Audio.setAudioModeAsync(PLAYBACK_HANDOFF).catch(() => undefined);
}

/**
 * Hands the session back to other apps. Prefer calling {@link unduckWhileSessionActive} first
 * while a recorder/sound is still loaded; this is the idle cleanup pass.
 */
export async function releaseAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync(PLAYBACK_HANDOFF).catch(() => undefined);
}

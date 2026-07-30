import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * The one place the app changes the shared audio session.
 *
 * Recording forces iOS into the PlayAndRecord category. Without an explicit interruption mode that
 * *interrupts* whatever the lifter is listening to, and an interrupted app only resumes when the
 * session is deactivated with `notifyOthersOnDeactivation` — a flag expo-av does not expose. So
 * music stopped when the mic opened and never came back.
 *
 * Ducking avoids the handshake entirely: other audio drops in volume while the mic is open and
 * returns to full by itself. It is also the better behaviour mid-set — the lifter hears their music
 * dip, speaks, and it comes back, rather than losing the track.
 *
 * Every call passes a complete mode rather than a patch, because `setAudioModeAsync` merges with
 * whatever was set last and two callers patching different fields is how this drifted.
 *
 * Important: expo-av only applies category changes while it considers the session active. Calling
 * MixWithOthers *after* `stopAndUnloadAsync` (session demoted to Inactive) stores the flag but
 * does not unduck on the hardware session — music stays quiet / HFP-routed until the app restarts.
 * Call `unduckWhileSessionActive` before unloading the recorder, then `releaseAudioSession`.
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

/** Mic open: duck other audio rather than stopping it. */
export async function enterVoiceCaptureMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    // Must be set before createAsync or iOS refuses to open the input route.
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/** Speaking a confirmation: audible over music without taking the session from it. */
export async function enterVoicePlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * Leave DuckOthers / PlayAndRecord while the recorder (or a just-finished cue) still keeps the
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

  // expo-av skips native category updates when it thinks the session is Inactive. Briefly
  // enabling then disabling the AV subsystem forces a re-apply so music is not left ducked /
  // stuck on the Bluetooth HFP route after the mic closes.
  try {
    await Audio.setIsEnabledAsync(false);
    await Audio.setIsEnabledAsync(true);
    await Audio.setAudioModeAsync(PLAYBACK_HANDOFF);
  } catch {
    // best effort — never fail the log/speak path over session cleanup
  }
}

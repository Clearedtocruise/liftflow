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
 */

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
 * Hands the session back. `allowsRecordingIOS: false` also restores playback to the speaker, which
 * otherwise stays routed to the earpiece for the rest of the session.
 */
export async function releaseAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  }).catch(() => undefined);
}

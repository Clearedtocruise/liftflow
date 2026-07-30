import { Audio } from 'expo-av';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { enterVoiceCaptureMode, releaseAudioSession, unduckWhileSessionActive } from '@/lib/voice/audioSession';
import {
  createEndOfSpeechState,
  DEFAULT_END_OF_SPEECH,
  reduceEndOfSpeech,
  type EndOfSpeechState,
} from '@/lib/voice/endOfSpeech';

/**
 * HIGH_QUALITY rather than LOW_QUALITY because the low preset writes `.caf` on iOS and `.3gp` on
 * Android, neither of which the transcription API accepts. High quality yields `.m4a` on both.
 * Metering is already enabled on the preset — required for end-of-speech auto-stop.
 */
const RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;

/** Guards against a stuck recorder holding the mic (and the audio session) open indefinitely. */
export const MAX_RECORDING_MS = 30_000;

/** How often we poll metering while listening for the end of an utterance. */
export const METERING_POLL_MS = 100;

export type RecordedAudio = {
  bytes: Uint8Array;
  contentType: string;
  uri: string;
};

export async function hasMicrophonePermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

/**
 * Starts a recording and optionally watches metering to call `onEndOfSpeech` when the user
 * finishes talking (or never starts). Returns a dispose function that clears the status listener.
 */
export async function startRecording(options?: {
  onEndOfSpeech?: () => void;
}): Promise<{ recording: Audio.Recording; dispose: () => void }> {
  await enterVoiceCaptureMode();
  try {
    let eosState: EndOfSpeechState = createEndOfSpeechState(Date.now());
    let stopped = false;

    const { recording } = await Audio.Recording.createAsync(
      RECORDING_OPTIONS,
      (status) => {
        if (stopped || !options?.onEndOfSpeech) return;
        if (!status.isRecording) return;
        const decision = reduceEndOfSpeech(
          eosState,
          status.metering,
          Date.now(),
          DEFAULT_END_OF_SPEECH,
        );
        eosState = decision.state;
        if (decision.shouldStop) {
          stopped = true;
          options.onEndOfSpeech();
        }
      },
      METERING_POLL_MS,
    );

    return {
      recording,
      dispose: () => {
        stopped = true;
        recording.setOnRecordingStatusUpdate(null);
      },
    };
  } catch (error) {
    // A recorder that never opened still left the session ducked, so the lifter's music stayed
    // quiet with nothing listening.
    await releaseAudioSession();
    throw error;
  }
}

function contentTypeForUri(uri: string): string {
  if (uri.endsWith('.webm')) return 'audio/webm';
  if (uri.endsWith('.wav')) return 'audio/wav';
  if (uri.endsWith('.mp4')) return 'audio/mp4';
  return 'audio/m4a';
}

/**
 * Always releases the audio session, even when reading the file fails, so a failed attempt cannot
 * leave playback routed to the earpiece for the rest of the session.
 *
 * Unduck *before* stopAndUnloadAsync: after unload, expo-av treats the session as Inactive and
 * silently skips applying MixWithOthers — which left music muted until the app restarted.
 */
export async function stopRecording(recording: Audio.Recording): Promise<RecordedAudio | null> {
  try {
    recording.setOnRecordingStatusUpdate(null);
    await unduckWhileSessionActive();
    await recording.stopAndUnloadAsync();
  } finally {
    await releaseAudioSession();
  }

  const uri = recording.getURI();
  if (!uri) return null;

  // expo-file-system's File cannot read blob: URIs, which is what the web recorder produces.
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(buffer), contentType: 'audio/webm', uri };
  }

  const bytes = await new File(uri).bytes();
  return { bytes, contentType: contentTypeForUri(uri), uri };
}

/** Best effort — a discarded recording that cannot be unloaded must not surface as an error. */
export async function cancelRecording(recording: Audio.Recording): Promise<void> {
  try {
    recording.setOnRecordingStatusUpdate(null);
    await unduckWhileSessionActive();
    await recording.stopAndUnloadAsync();
  } catch {
    // already unloaded
  }
  await releaseAudioSession();
}

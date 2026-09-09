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
import { isRecorderSessionBusyError } from '@/lib/voice/recorderSessionError';

/**
 * HIGH_QUALITY rather than LOW_QUALITY because the low preset writes `.caf` on iOS and `.3gp` on
 * Android, neither of which the transcription API accepts. High quality yields `.m4a` on both.
 * Metering is already enabled on the preset — required for end-of-speech auto-stop.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  // Explicit — some devices omit metering from the preset merge and then end-of-speech never
  // sees speech, so the hard cap is the only stop and empty takes look like a broken mic.
  isMeteringEnabled: true,
};

/**
 * Last-resort cap if both end-of-speech paths go quiet. A spoken set is a few seconds, so 30s of
 * open mic just reads as broken and keeps the music ducked that whole time.
 */
export const MAX_RECORDING_MS = 15_000;

/** How often we poll metering while listening for the end of an utterance. */
export const METERING_POLL_MS = 100;

/** The native layer only allows one Recording at a time — keep the live handle here to unload it. */
let liveRecording: Audio.Recording | null = null;

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
  if (liveRecording) {
    await cancelRecording(liveRecording);
  }

  await enterVoiceCaptureMode();
  try {
    return await openRecording(options);
  } catch (error) {
    // A leftover native recorder (or a rest-complete cue that still holds the session) surfaces
    // as "busy" / "recorder not prepared". Tear it down and try once more before failing.
    if (!isRecorderSessionBusyError(error)) {
      await releaseAudioSession();
      throw error;
    }
    if (liveRecording) {
      await cancelRecording(liveRecording);
    } else {
      await releaseAudioSession();
    }
    await enterVoiceCaptureMode();
    try {
      return await openRecording(options);
    } catch (retryError) {
      await releaseAudioSession();
      throw retryError;
    }
  }
}

async function openRecording(options?: {
  onEndOfSpeech?: () => void;
}): Promise<{ recording: Audio.Recording; dispose: () => void }> {
  let eosState: EndOfSpeechState = createEndOfSpeechState(Date.now());
  let stopped = false;
  let poll: ReturnType<typeof setInterval> | null = null;

  const clearPoll = () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  };

  const evaluate = (metering: number | undefined, isRecording: boolean) => {
    if (stopped || !options?.onEndOfSpeech || !isRecording) return;
    const decision = reduceEndOfSpeech(eosState, metering, Date.now(), DEFAULT_END_OF_SPEECH);
    eosState = decision.state;
    if (!decision.shouldStop) return;
    stopped = true;
    clearPoll();
    options.onEndOfSpeech();
  };

  const { recording } = await Audio.Recording.createAsync(
    RECORDING_OPTIONS,
    (status) => evaluate(status.metering, status.isRecording),
    METERING_POLL_MS,
  );
  liveRecording = recording;

  /**
   * The status callback is not delivered reliably on device — when it goes quiet nothing ever
   * ends the capture, so the mic stays open, the transcript never arrives, no set is logged and
   * the audio session stays held. Poll the recorder directly as well; both paths feed the same
   * reducer, so whichever fires first ends the utterance.
   */
  if (options?.onEndOfSpeech) {
    poll = setInterval(() => {
      if (stopped) return;
      void recording
        .getStatusAsync()
        .then((status) => evaluate(status.metering, status.isRecording))
        .catch(() => {
          clearPoll();
        });
    }, METERING_POLL_MS);
  }

  return {
    recording,
    dispose: () => {
      stopped = true;
      clearPoll();
      recording.setOnRecordingStatusUpdate(null);
    },
  };
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
    if (liveRecording === recording) liveRecording = null;
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
  if (liveRecording === recording) liveRecording = null;
  await releaseAudioSession();
}

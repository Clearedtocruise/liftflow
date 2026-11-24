import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, type AudioRecorder } from 'expo-audio';
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
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  // Explicit — some devices omit metering from the preset merge and then end-of-speech never
  // sees speech, so the hard cap is the only stop and empty takes look like a broken mic.
  isMeteringEnabled: true,
};

/**
 * The native recorder takes the platform's own flat options. `useAudioRecorder` does this
 * flattening itself; this app holds one imperative recorder, so it does the same here.
 */
function nativeRecordingOptions() {
  const { ios, android, web, ...common } = RECORDING_OPTIONS as typeof RECORDING_OPTIONS & {
    ios?: object;
    android?: object;
    web?: object;
  };
  const platform = Platform.OS === 'ios' ? ios : Platform.OS === 'android' ? android : web;
  return { ...common, ...platform };
}

/**
 * Last-resort cap if both end-of-speech paths go quiet. A spoken set is a few seconds, so 30s of
 * open mic just reads as broken and keeps the music ducked that whole time.
 */
export const MAX_RECORDING_MS = 15_000;

/** How often we poll metering while listening for the end of an utterance. */
export const METERING_POLL_MS = 100;

/**
 * Below this a take is a container header with no samples. The backend rejects it anyway, so
 * uploading one only spends a slot of the voice rate limit — which is how a run of failed taps
 * turned into "Voice is busy" mid-workout. Mirrors MIN_AUDIO_BYTES on the server.
 */
export const MIN_TRANSCRIBE_BYTES = 1024;

/** The native layer only allows one Recording at a time — keep the live handle here to unload it. */
export type VoiceRecording = AudioRecorder;

let liveRecording: VoiceRecording | null = null;

export type RecordedAudio = {
  bytes: Uint8Array;
  contentType: string;
  uri: string;
};

export async function hasMicrophonePermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

/**
 * Starts a recording and optionally watches metering to call `onEndOfSpeech` when the user
 * finishes talking (or never starts). Returns a dispose function that clears the status listener.
 */
export type RecordingCallbacks = {
  onEndOfSpeech?: () => void;
  /**
   * Fired once, the first time metering crosses the speech threshold. "The mic isn't working" and
   * "it misheard me" look identical without this — the screen can now say which one happened.
   */
  onSpeechDetected?: () => void;
};

export async function startRecording(
  options?: RecordingCallbacks,
): Promise<{ recording: VoiceRecording; dispose: () => void }> {
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

async function openRecording(
  options?: RecordingCallbacks,
): Promise<{ recording: VoiceRecording; dispose: () => void }> {
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
    if (stopped || !isRecording) return;
    const decision = reduceEndOfSpeech(eosState, metering, Date.now(), DEFAULT_END_OF_SPEECH);
    const wasSilent = !eosState.speechHeard;
    eosState = decision.state;
    if (wasSilent && eosState.speechHeard) options?.onSpeechDetected?.();
    if (!options?.onEndOfSpeech || !decision.shouldStop) return;
    stopped = true;
    clearPoll();
    options.onEndOfSpeech();
  };

  const recording = new AudioModule.AudioRecorder(nativeRecordingOptions());
  try {
    await recording.prepareToRecordAsync();
    recording.record();
  } catch (error) {
    recording.release();
    throw error;
  }
  liveRecording = recording;

  // The recorder is polled for its meter reading: nothing else ends a capture, so a silent
  // poll would leave the mic open, no set logged and the audio session held.
  if (options?.onEndOfSpeech || options?.onSpeechDetected) {
    poll = setInterval(() => {
      if (stopped) return;
      try {
        const status = recording.getStatus();
        evaluate(status.metering, status.isRecording);
      } catch {
        clearPoll();
      }
    }, METERING_POLL_MS);
  }

  return {
    recording,
    dispose: () => {
      stopped = true;
      clearPoll();
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
 * Unduck *before* stopping: once the recorder is torn down the session can be Inactive, and a
 * mode applied then never reaches the hardware — which left music muted until the app restarted.
 */
export async function stopRecording(recording: VoiceRecording): Promise<RecordedAudio | null> {
  let uri: string | null = null;
  try {
    await unduckWhileSessionActive();
    await recording.stop();
    uri = recording.uri ?? recording.getStatus().url;
  } finally {
    if (liveRecording === recording) liveRecording = null;
    await releaseAudioSession();
  }

  if (!uri) {
    recording.release();
    return null;
  }

  // expo-file-system's File cannot read blob: URIs, which is what the web recorder produces.
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(buffer), contentType: 'audio/webm', uri };
  }

  const bytes = await new File(uri).bytes();
  recording.release();
  return { bytes, contentType: contentTypeForUri(uri), uri };
}

/** Best effort — a discarded recording that cannot be unloaded must not surface as an error. */
export async function cancelRecording(recording: VoiceRecording): Promise<void> {
  try {
    await unduckWhileSessionActive();
    await recording.stop();
  } catch {
    // already stopped
  }
  try {
    recording.release();
  } catch {
    // already released
  }
  if (liveRecording === recording) liveRecording = null;
  await releaseAudioSession();
}

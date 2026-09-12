import type { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/api/client';
import {
  cancelRecording,
  hasMicrophonePermission,
  MAX_RECORDING_MS,
  MIN_TRANSCRIBE_BYTES,
  startRecording,
  stopRecording,
} from '@/lib/voice/recordAudio';
import { isRecorderSessionBusyError } from '@/lib/voice/recorderSessionError';
import {
  throttledMessage,
  toVoiceFailure,
  voiceCooldownMs,
  voiceFailureMessage,
} from '@/lib/voice/voiceFailure';
import { getAccessToken } from '@/supabase/client';
import type { VoiceInputMode } from '@/types/voice';

/** The real states of a capture attempt — the UI shows one hint per state instead of guessing. */
export type VoiceCaptureState = 'idle' | 'recording' | 'transcribing' | 'error';

export type VoiceRecognitionOptions = {
  enabled?: boolean;
  inputMode?: VoiceInputMode;
  onFinalTranscript?: (text: string) => void;
  lang?: string;
};

const PERMISSION_DENIED = 'Microphone access is off. Enable it in Settings to log sets by voice.';

export function useVoiceRecognition(options: VoiceRecognitionOptions = {}) {
  const { enabled = true, inputMode = 'tap_toggle', onFinalTranscript } = options;

  const transcriptRef = useRef('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const disposeMonitorRef = useRef<(() => void) | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);
  const stopListeningRef = useRef<() => Promise<void>>(async () => undefined);
  /** Epoch ms until which the server has asked us to stop sending audio. */
  const cooldownUntilRef = useRef(0);
  /** Whether metering crossed the speech threshold during the take now in progress. */
  const heardSpeechRef = useRef(false);

  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isHearingSpeech, setIsHearingSpeech] = useState(false);

  const clearAutoStop = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const clearMonitor = useCallback(() => {
    disposeMonitorRef.current?.();
    disposeMonitorRef.current = null;
  }, []);

  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    setFinalTranscript('');
    setError(null);
    setState((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const stopListening = useCallback(async () => {
    if (stoppingRef.current) return;
    clearAutoStop();
    clearMonitor();
    const active = recordingRef.current;
    if (!active) return;
    stoppingRef.current = true;
    recordingRef.current = null;

    setState('transcribing');
    try {
      const recorded = await stopRecording(active);
      // A take with no samples is worth a message, not a round trip against the voice budget.
      if (!recorded || recorded.bytes.byteLength < MIN_TRANSCRIBE_BYTES) {
        setError('No audio was recorded. Tap the mic and speak your set.');
        setState('error');
        return;
      }

      // Silence reads as a broken feature, and the generic "didn't catch that" sends the lifter
      // back to say it louder when the real problem is that the input never opened.
      if (!heardSpeechRef.current) {
        setError('The mic never picked up any sound. Check ONE MORE\u2019s microphone access in Settings.');
        setState('error');
        return;
      }

      const token = await getAccessToken();
      const { transcript } = await api.transcribeVoice(recorded.bytes, recorded.contentType, token);

      if (!mountedRef.current) return;

      // Silent audio transcribes successfully to an empty string, which downstream parsing reports
      // as bad phrasing — telling a user who mumbled that their wording was wrong.
      if (!transcript.trim()) {
        setError("Didn't catch that. Tap the mic and speak clearly.");
        setState('error');
        return;
      }

      transcriptRef.current = transcript;
      setFinalTranscript(transcript);
      cooldownUntilRef.current = 0;
      setState('idle');
      onFinalTranscript?.(transcript);
    } catch (e) {
      if (!mountedRef.current) return;
      const failure = toVoiceFailure(e);
      // Every tap during a throttle spends another slot, so hold the mic until the window drains.
      const cooldown = voiceCooldownMs(failure);
      cooldownUntilRef.current = cooldown > 0 ? Date.now() + cooldown : 0;
      setError(voiceFailureMessage(failure));
      setState('error');
    } finally {
      stoppingRef.current = false;
    }
  }, [clearAutoStop, clearMonitor, onFinalTranscript]);

  stopListeningRef.current = stopListening;

  const startListening = useCallback(async () => {
    if (!enabled || recordingRef.current || stoppingRef.current) return false;

    const cooldownRemaining = cooldownUntilRef.current - Date.now();
    if (cooldownRemaining > 0) {
      setError(throttledMessage(cooldownRemaining / 1000));
      setState('error');
      return false;
    }

    setError(null);
    heardSpeechRef.current = false;
    setIsHearingSpeech(false);
    try {
      if (!(await hasMicrophonePermission())) {
        setError(PERMISSION_DENIED);
        setState('error');
        return false;
      }

      const { recording, dispose } = await startRecording({
        onEndOfSpeech: () => {
          void stopListeningRef.current();
        },
        onSpeechDetected: () => {
          heardSpeechRef.current = true;
          if (mountedRef.current) setIsHearingSpeech(true);
        },
      });
      if (!mountedRef.current) {
        dispose();
        void cancelRecording(recording);
        return false;
      }

      recordingRef.current = recording;
      disposeMonitorRef.current = dispose;
      setState('recording');
      // Hard cap only — normal stops come from end-of-speech silence detection.
      autoStopRef.current = setTimeout(() => void stopListeningRef.current(), MAX_RECORDING_MS);
      return true;
    } catch (e) {
      if (isRecorderSessionBusyError(e)) {
        setError('Mic was still wrapping up — tap again.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not start recording.');
      }
      setState('error');
      return false;
    }
  }, [enabled]);

  const abortListening = useCallback(() => {
    clearAutoStop();
    clearMonitor();
    stoppingRef.current = false;
    const active = recordingRef.current;
    recordingRef.current = null;
    if (active) void cancelRecording(active);
    setState('idle');
  }, [clearAutoStop, clearMonitor]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      clearAutoStop();
      clearMonitor();
      const active = recordingRef.current;
      recordingRef.current = null;
      if (active) void cancelRecording(active);
    },
    [clearAutoStop, clearMonitor],
  );

  const handlePressIn = useCallback(async () => {
    if (inputMode !== 'push_to_talk') return false;
    return startListening();
  }, [inputMode, startListening]);

  const handlePressOut = useCallback(() => {
    if (inputMode !== 'push_to_talk') return;
    void stopListening();
  }, [inputMode, stopListening]);

  // Tap once to start; silence auto-stops. A second tap still stops early if needed.
  // Screen readers can only fire onPress, so push-to-talk callers fall back to this path.
  const handleMicPress = useCallback(async () => {
    if (recordingRef.current) {
      await stopListening();
      return true;
    }
    return startListening();
  }, [startListening, stopListening]);

  return {
    isAvailable: enabled,
    state,
    isListening: state === 'recording',
    isTranscribing: state === 'transcribing',
    /** Metering has crossed the speech threshold during this take — the mic is picking the user up. */
    isHearingSpeech,
    /** Kept for compatibility: this pipeline has no partial results, only a final transcript. */
    interimTranscript: '',
    finalTranscript,
    transcript: finalTranscript,
    transcriptRef,
    error,
    inputMode,
    startListening,
    stopListening,
    abortListening,
    clearTranscript,
    handlePressIn,
    handlePressOut,
    handleMicPress,
  };
}

/** Simple tap-to-toggle capture for nutrition/coach screens */
export function useVoiceLogging(options: VoiceRecognitionOptions = {}) {
  return useVoiceRecognition({ inputMode: 'tap_toggle', ...options });
}

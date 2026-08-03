import type { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/api/client';
import {
  cancelRecording,
  hasMicrophonePermission,
  MAX_RECORDING_MS,
  startRecording,
  stopRecording,
} from '@/lib/voice/recordAudio';
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

  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      if (!recorded || recorded.bytes.byteLength === 0) {
        throw new Error('No audio was recorded. Tap the mic and speak your set.');
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
      setState('idle');
      onFinalTranscript?.(transcript);
    } catch (e) {
      if (!mountedRef.current) return;
      const raw = e instanceof Error ? e.message : '';
      const lower = raw.toLowerCase();
      // Backend rate-limit copy is written for operators; surface a gym-friendly retry instead.
      if (
        lower.includes('too many requests') ||
        lower.includes('rate limit') ||
        lower.includes('voice is busy') ||
        lower.includes('ai request limit')
      ) {
        setError('Voice is busy — wait a few seconds and try again.');
      } else {
        // The backend already returns user-facing messages; anything else gets a generic one.
        setError(raw || 'Could not transcribe that. Try again.');
      }
      setState('error');
    } finally {
      stoppingRef.current = false;
    }
  }, [clearAutoStop, clearMonitor, onFinalTranscript]);

  stopListeningRef.current = stopListening;

  const startListening = useCallback(async () => {
    if (!enabled || recordingRef.current || stoppingRef.current) return false;

    setError(null);
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
      setError(e instanceof Error ? e.message : 'Could not start recording.');
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

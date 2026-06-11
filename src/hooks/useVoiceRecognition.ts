import { useCallback, useEffect, useRef, useState } from 'react';

import { VOICE_STABILIZATION_MESSAGE } from '@/constants/stabilization';
import { forensicLog } from '@/lib/forensicLog';
import type { VoiceInputMode } from '@/types/voice';

export type VoiceRecognitionOptions = {
  enabled?: boolean;
  inputMode?: VoiceInputMode;
  onFinalTranscript?: (text: string) => void;
  lang?: string;
};

/** Stabilization stub — never loads expo-speech-recognition. */
export function useVoiceRecognition(options: VoiceRecognitionOptions = {}) {
  const { inputMode = 'push_to_talk' } = options;

  useEffect(() => {
    forensicLog('VOICE_INIT_START', { mode: 'stub' });
    forensicLog('VOICE_INIT_SUCCESS', { available: false, reason: 'stabilization_stub' });
  }, []);

  const [interimTranscript] = useState('');
  const [isListening] = useState(false);
  const [error] = useState<string | null>(VOICE_STABILIZATION_MESSAGE);
  const transcriptRef = useRef('');

  const noopAsync = useCallback(async () => false, []);
  const noop = useCallback(() => {}, []);

  return {
    isAvailable: false,
    isListening,
    interimTranscript,
    finalTranscript: '',
    transcript: interimTranscript,
    transcriptRef,
    error,
    voiceUnavailable: true,
    inputMode,
    startListening: noopAsync,
    stopListening: noop,
    abortListening: noop,
    clearTranscript: noop,
    handlePressIn: noopAsync,
    handlePressOut: noop,
    handleMicPress: noopAsync,
  };
}

export function useVoiceLogging() {
  return useVoiceRecognition({ inputMode: 'tap_toggle' });
}

import { useCallback, useRef, useState } from 'react';

import type { VoiceInputMode } from '@/types/voice';

/** Voice disabled for Build 155 stabilization — no native speech module loads. */
const VOICE_DISABLED_MESSAGE = 'Voice logging is temporarily unavailable.';

export type VoiceRecognitionOptions = {
  enabled?: boolean;
  inputMode?: VoiceInputMode;
  onFinalTranscript?: (text: string) => void;
  lang?: string;
};

export function useVoiceRecognition(_options: VoiceRecognitionOptions = {}) {
  const transcriptRef = useRef('');
  const [isListening] = useState(false);

  const noop = useCallback(() => {}, []);
  const noopAsync = useCallback(async () => false, []);

  return {
    isAvailable: false,
    isListening,
    interimTranscript: '',
    finalTranscript: '',
    transcript: '',
    transcriptRef,
    error: VOICE_DISABLED_MESSAGE,
    inputMode: 'tap_toggle' as VoiceInputMode,
    startListening: noopAsync,
    stopListening: noop,
    abortListening: noop,
    clearTranscript: noop,
    handlePressIn: noopAsync,
    handlePressOut: noop,
    handleMicPress: noopAsync,
  };
}

/** Simple tap-to-toggle STT for nutrition/coach screens */
export function useVoiceLogging() {
  return useVoiceRecognition({ inputMode: 'tap_toggle' });
}

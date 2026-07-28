import * as Speech from 'expo-speech';

import { enterVoicePlaybackMode, releaseAudioSession } from '@/lib/voice/audioSession';

type SpeakCueOptions = {
  rate?: number;
  pitch?: number;
  language?: string;
};

/**
 * Speak a short cue without leaving the lifter's music ducked.
 *
 * expo-speech takes the shared audio session. Without an explicit duck + release around it,
 * "Rest complete…" (and similar) can finish speaking while Spotify/Apple Music stay quiet.
 */
export async function speakCue(message: string, options: SpeakCueOptions = {}): Promise<void> {
  const text = message.trim();
  if (!text) return;

  Speech.stop();
  await enterVoicePlaybackMode();

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      void releaseAudioSession().finally(resolve);
    };

    // If the platform never fires onDone (rare), do not leave music ducked forever.
    const safetyTimer = setTimeout(finish, Math.min(20_000, Math.max(4_000, text.length * 90)));

    Speech.speak(text, {
      rate: options.rate ?? 1,
      pitch: options.pitch ?? 1,
      language: options.language,
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });
}

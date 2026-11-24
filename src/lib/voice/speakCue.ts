import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import { enterVoicePlaybackMode, releaseAudioSession, unduckWhileSessionActive } from '@/lib/voice/audioSession';

type SpeakCueOptions = {
  rate?: number;
  pitch?: number;
  language?: string;
};

/**
 * Speak a short cue without ever touching the volume of the lifter's music.
 *
 * On iOS the cue is spoken on the app's own session, set to mix with other audio and not to duck
 * it. A private speech session used to be used so the system would restore the music after the
 * phrase, but that duck can outlive the phrase: the music stayed quiet until the app was left.
 * Ducking is only ever undone by whoever asked for it, so asking for none leaves nothing to
 * undo. The phrase plays over the music instead of lowering it.
 */
export async function speakCue(message: string, options: SpeakCueOptions = {}): Promise<void> {
  const text = message.trim();
  if (!text) return;

  Speech.stop();

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve();
    };

    // If the platform never fires onDone, do not leave the caller hanging.
    const safetyTimer = setTimeout(finish, Math.min(20_000, Math.max(4_000, text.length * 90)));

    if (Platform.OS === 'ios') {
      // Drop any duck the recorder still holds, then speak on the now mix-only session.
      void releaseAudioSession().finally(() => {
        Speech.speak(text, {
          rate: options.rate ?? 1,
          pitch: options.pitch ?? 1,
          language: options.language,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      });
      return;
    }

    void enterVoicePlaybackMode().finally(() => {
      Speech.speak(text, {
        rate: options.rate ?? 1,
        pitch: options.pitch ?? 1,
        language: options.language,
        onDone: () => {
          void unduckWhileSessionActive().then(() => releaseAudioSession()).finally(finish);
        },
        onStopped: () => {
          void unduckWhileSessionActive().then(() => releaseAudioSession()).finally(finish);
        },
        onError: () => {
          void unduckWhileSessionActive().then(() => releaseAudioSession()).finally(finish);
        },
      });
    });
  });
}

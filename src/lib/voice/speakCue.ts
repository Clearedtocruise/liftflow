import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import { enterVoicePlaybackMode, releaseAudioSession, unduckWhileSessionActive } from '@/lib/voice/audioSession';

type SpeakCueOptions = {
  rate?: number;
  pitch?: number;
  language?: string;
};

/**
 * Speak a short cue and hand the lifter's music back when it ends.
 *
 * On iOS the cue must not borrow the shared session. Recording already ducked it, and expo-av
 * never deactivates that session with the flag other apps need in order to resume, so a
 * confirmation spoken on the shared session left Spotify quiet after the set was logged.
 * A private speech session ducks for the phrase and restores the other audio itself.
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
      // Drop any duck the recorder still holds before the private session starts, or that duck
      // outlives the phrase. Do not touch the session again once the phrase ends: toggling it
      // then pauses the music the speech session just restored.
      void releaseAudioSession().finally(() => {
        Speech.speak(text, {
          rate: options.rate ?? 1,
          pitch: options.pitch ?? 1,
          language: options.language,
          useApplicationAudioSession: false,
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

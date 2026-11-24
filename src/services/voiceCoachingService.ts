import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { enterVoicePlaybackMode, releaseAudioSession } from '@/lib/voice/audioSession';
import { speakCue } from '@/lib/voice/speakCue';
import { aiService } from '@/services/aiService';
import { getAccessToken } from '@/supabase/client';
import type { CoachingRequest } from '@/types/ai';
import type { ServiceResult } from '@/types/common';

let player: AudioPlayer | null = null;

function releasePlayer() {
  const current = player;
  player = null;
  try {
    current?.remove();
  } catch {
    // already released
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function playOpenAiSpeech(text: string): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/api/ai/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as { audioBase64?: string };
    if (!data.audioBase64) return false;

    releasePlayer();

    // Ducks the lifter's music for the length of the reply instead of taking the session from it.
    await enterVoicePlaybackMode();
    const file = new File(Paths.cache, 'coach-reply.mp3');
    file.create({ overwrite: true });
    file.write(base64ToBytes(data.audioBase64));
    const reply = createAudioPlayer({ uri: file.uri });
    player = reply;
    const subscription = reply.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      subscription.remove();
      void releaseAudioSession();
    });
    reply.play();
    return true;
  } catch {
    return false;
  }
}

export const voiceCoachingService = {
  async askAndSpeak(
    userId: string,
    request: CoachingRequest,
  ): Promise<ServiceResult<{ response: string; sessionId: string; usedOpenAiTts: boolean }>> {
    try {
      const coachResult = await aiService.askCoach(userId, request);
      if (!coachResult.success) return fail(coachResult.error);

      const responseText = coachResult.data.response;
      const playedOpenAi = await playOpenAiSpeech(responseText);

      if (!playedOpenAi) {
        await speakCue(responseText, {
          language: 'en-US',
          rate: Platform.OS === 'ios' ? 0.52 : 0.9,
          pitch: 1.0,
        });
      }

      return ok({
        response: responseText,
        sessionId: coachResult.data.id,
        usedOpenAiTts: playedOpenAi,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  stopSpeaking() {
    Speech.stop();
    releasePlayer();
    void releaseAudioSession();
  },

  async speakLine(text: string): Promise<boolean> {
    const playedOpenAi = await playOpenAiSpeech(text);
    if (!playedOpenAi) {
      await speakCue(text, {
        language: 'en-US',
        rate: Platform.OS === 'ios' ? 0.52 : 0.9,
        pitch: 1.0,
      });
    }
    return playedOpenAi;
  },
};

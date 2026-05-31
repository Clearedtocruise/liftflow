import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { aiService } from '@/services/aiService';
import { getAccessToken } from '@/supabase/client';
import type { CoachingRequest } from '@/types/ai';
import type { ServiceResult } from '@/types/common';

let sound: Audio.Sound | null = null;

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

    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const uri = `data:audio/mp3;base64,${data.audioBase64}`;
    const { sound: newSound } = await Audio.Sound.createAsync({ uri });
    sound = newSound;
    await newSound.playAsync();
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
        Speech.speak(responseText, {
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
    sound?.stopAsync().catch(() => undefined);
  },

  async speakLine(text: string): Promise<boolean> {
    const playedOpenAi = await playOpenAiSpeech(text);
    if (!playedOpenAi) {
      Speech.speak(text, {
        language: 'en-US',
        rate: Platform.OS === 'ios' ? 0.52 : 0.9,
        pitch: 1.0,
      });
    }
    return playedOpenAi;
  },
};

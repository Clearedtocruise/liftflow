import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

const VOICE_CACHE_KEY = 'preferred_speech_voice_id_v1';

let cachedVoiceId: string | null | undefined;

const PREFERRED_NAME_HINTS = [
  'nova',
  'samantha',
  'zoe',
  'karen',
  'moira',
  'ava',
  'allison',
  'nicky',
  'enhanced',
  'premium',
  'neural',
];

function scoreVoice(voice: Speech.Voice): number {
  const id = `${voice.identifier} ${voice.name}`.toLowerCase();
  let score = 0;
  if (voice.language?.toLowerCase().startsWith('en-us')) score += 40;
  else if (voice.language?.toLowerCase().startsWith('en')) score += 20;
  if (voice.quality === Speech.VoiceQuality.Enhanced) score += 30;
  for (const hint of PREFERRED_NAME_HINTS) {
    if (id.includes(hint)) score += 8;
  }
  return score;
}

/** Pick a warmer en-US (or en) system voice when available. */
export async function resolvePreferredSpeechVoiceId(): Promise<string | undefined> {
  if (cachedVoiceId !== undefined) return cachedVoiceId ?? undefined;

  try {
    const stored = await AsyncStorage.getItem(VOICE_CACHE_KEY);
    if (stored) {
      cachedVoiceId = stored;
      return stored;
    }
  } catch {
    // ignore
  }

  if (Platform.OS === 'web') {
    cachedVoiceId = null;
    return undefined;
  }

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const best = ranked[0];
    cachedVoiceId = best?.identifier ?? null;
    if (cachedVoiceId) {
      await AsyncStorage.setItem(VOICE_CACHE_KEY, cachedVoiceId).catch(() => undefined);
    }
    return cachedVoiceId ?? undefined;
  } catch {
    cachedVoiceId = null;
    return undefined;
  }
}

export function clearPreferredSpeechVoiceCache(): void {
  cachedVoiceId = undefined;
}

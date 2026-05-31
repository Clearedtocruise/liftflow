import type { UserPreferences, UserProfile } from '@/types';
import { DEFAULT_VOICE_SETTINGS, type VoiceInputMode, type VoiceSettings } from '@/types/voice';

export const VOICE_PREF_KEYS = {
  inputMode: 'voiceInputMode',
  autoLog: 'voiceAutoLog',
  wakePhraseEnabled: 'wakePhraseEnabled',
} as const;

function parseInputMode(value: unknown): VoiceInputMode {
  if (value === 'tap_toggle' || value === 'continuous' || value === 'push_to_talk') return value;
  return DEFAULT_VOICE_SETTINGS.inputMode;
}

export function voiceSettingsFromUser(
  profile: UserProfile | null | undefined,
  preferences: UserPreferences | null | undefined,
): VoiceSettings {
  const coaching = preferences?.coachingPreferences ?? {};
  return {
    confirmationMode: profile?.confirmationMode ?? DEFAULT_VOICE_SETTINGS.confirmationMode,
    autoLog: coaching[VOICE_PREF_KEYS.autoLog] !== false,
    voiceFeedback: preferences?.voiceFeedback ?? DEFAULT_VOICE_SETTINGS.voiceFeedback,
    inputMode: parseInputMode(coaching[VOICE_PREF_KEYS.inputMode]),
    wakePhraseEnabled: coaching[VOICE_PREF_KEYS.wakePhraseEnabled] === true,
  };
}

export function coachingPrefsPatch(settings: Partial<VoiceSettings>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (settings.inputMode !== undefined) patch[VOICE_PREF_KEYS.inputMode] = settings.inputMode;
  if (settings.autoLog !== undefined) patch[VOICE_PREF_KEYS.autoLog] = settings.autoLog;
  if (settings.wakePhraseEnabled !== undefined) {
    patch[VOICE_PREF_KEYS.wakePhraseEnabled] = settings.wakePhraseEnabled;
  }
  return patch;
}

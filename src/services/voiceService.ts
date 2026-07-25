import { api } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import {
    enrichParsedCommand,
    parseVoiceCommandLocal,
    resolveFromVoiceSettings,
} from '@/lib/voice';
import { FAST_PATH_CONFIDENCE } from '@/lib/voice/voicePlausibility';
import { voiceSettingsFromUser } from '@/lib/voice/voicePreferences';
import type { IVoiceService } from '@/services/interfaces';
import { userService } from '@/services/userService';
import { supabase } from '@/supabase/client';
import type { ParseVoiceRequest } from '@/types';
import type { ParsedVoiceCommandExtended, ProcessVoiceResult, VoiceParseContext, VoiceSettings } from '@/types/voice';
import { DEFAULT_VOICE_SETTINGS } from '@/types/voice';

function buildContext(request: ParseVoiceRequest): VoiceParseContext {
  const ctx = request.context ?? {};
  return {
    activeExerciseName: ctx.activeExerciseName as string | undefined,
    lastWeight: ctx.lastWeight as number | undefined,
    lastReps: ctx.lastReps as number | undefined,
    preferredWeightUnit: ctx.preferredWeightUnit as 'lb' | 'kg' | undefined,
    setNumber: ctx.setNumber as number | undefined,
  };
}

export async function loadVoiceSettings(userId: string): Promise<VoiceSettings> {
  const [profile, prefs] = await Promise.all([
    userService.getProfile(userId),
    userService.getPreferences(userId),
  ]);
  return voiceSettingsFromUser(
    profile.success ? profile.data : null,
    prefs.success ? prefs.data : null,
  );
}

export async function processVoiceTranscript(
  userId: string,
  request: ParseVoiceRequest,
  settingsOverride?: Partial<VoiceSettings>,
): Promise<import('@/types/common').ServiceResult<ProcessVoiceResult>> {
  try {
    const settings = { ...(await loadVoiceSettings(userId)), ...settingsOverride };
    const context = buildContext(request);
    const local = parseVoiceCommandLocal(request.transcript, context);
    const enrichedLocal = local ? enrichParsedCommand(local, context) : null;

    if (enrichedLocal && (enrichedLocal.confidence ?? 0) >= FAST_PATH_CONFIDENCE) {
      const { requiresConfirmation, confirmationReason } = resolveFromVoiceSettings(
        enrichedLocal.confidence ?? 0.85,
        settings,
        enrichedLocal,
      );
      return ok({
        parsed: enrichedLocal,
        confidence: enrichedLocal.confidence ?? 0.85,
        requiresConfirmation,
        confirmationReason,
      });
    }

    try {
      const remote = await api.parseVoice({ ...request, context: context as Record<string, unknown> });
      const parsed = enrichParsedCommand(
        { ...remote.parsed, intent: remote.parsed.intent ?? 'log_set' } as ParsedVoiceCommandExtended,
        context,
      );
      const { requiresConfirmation, confirmationReason } = resolveFromVoiceSettings(
        remote.confidence,
        settings,
        parsed,
      );
      // An implausible value must survive a "never confirm" preference, so the parsed flags win
      // over confirmationMode here rather than being short-circuited by it.
      return ok({
        parsed,
        confidence: remote.confidence,
        requiresConfirmation: parsed.implausible === true
          ? true
          : settings.confirmationMode === 'none'
            ? false
            : remote.requiresConfirmation || requiresConfirmation,
        confirmationReason: parsed.validationReason ?? remote.confirmationReason ?? confirmationReason,
      });
    } catch {
      if (enrichedLocal) {
        const { requiresConfirmation, confirmationReason } = resolveFromVoiceSettings(
          enrichedLocal.confidence ?? 0.6,
          settings,
          enrichedLocal,
        );
        return ok({
          parsed: enrichedLocal,
          confidence: enrichedLocal.confidence ?? 0.6,
          requiresConfirmation,
          confirmationReason,
        });
      }
      return fail('Could not parse voice command. Try: "Bench press 225 for 8"');
    }
  } catch (e) {
    return fromError(e);
  }
}

/** @deprecated Use processVoiceTranscript — kept for IVoiceService compatibility */
export const voiceRecognitionService = {
  processVoiceTranscript,
  loadVoiceSettings,
};

export const voiceService: IVoiceService = {
  async parseCommand(request) {
    const context = buildContext(request);
    const local = parseVoiceCommandLocal(request.transcript, context);
    const enriched = local ? enrichParsedCommand(local, context) : null;

    // No userId here, so the user's stored preferences are unavailable — the defaults still go
    // through the shared resolver so the implausibility gate cannot be bypassed by entry point.
    if (enriched && (enriched.confidence ?? 0) >= FAST_PATH_CONFIDENCE) {
      const confidence = enriched.confidence ?? 0.85;
      return ok({
        parsed: enriched,
        confidence,
        ...resolveFromVoiceSettings(confidence, DEFAULT_VOICE_SETTINGS, enriched),
      });
    }

    try {
      const remote = await api.parseVoice({ ...request, context: context as Record<string, unknown> });
      const parsed = enrichParsedCommand(
        { ...remote.parsed, intent: remote.parsed.intent ?? 'log_set' } as ParsedVoiceCommandExtended,
        context,
      );
      return ok({
        parsed,
        confidence: remote.confidence,
        requiresConfirmation: remote.requiresConfirmation || parsed.implausible === true,
        confirmationReason: parsed.validationReason ?? remote.confirmationReason,
      });
    } catch {
      if (enriched) {
        return ok({
          parsed: enriched,
          confidence: enriched.confidence ?? 0.6,
          requiresConfirmation: true,
          confirmationReason: 'Low confidence parse — please confirm',
        });
      }
      return fail('Could not parse voice command. Try: "Bench press 225 for 8"');
    }
  },

  async logEntry(userId, entry) {
    try {
      const { data, error } = await supabase
        .from('voice_log_entries')
        .insert({
          user_id: userId,
          session_id: entry.sessionId,
          raw_transcript: entry.rawTranscript,
          audio_url: entry.audioUrl,
          status: entry.status,
          confidence: entry.confidence,
          parsed_data: entry.parsedData,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        sessionId: data.session_id ?? undefined,
        rawTranscript: data.raw_transcript,
        audioUrl: data.audio_url ?? undefined,
        status: data.status,
        confidence: data.confidence ?? undefined,
        parsedData: data.parsed_data ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async confirmEntry(entryId) {
    try {
      const { data, error } = await supabase
        .from('voice_log_entries')
        .update({ status: 'confirmed' })
        .eq('id', entryId)
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        sessionId: data.session_id ?? undefined,
        rawTranscript: data.raw_transcript,
        status: data.status,
        parsedData: data.parsed_data ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async rejectEntry(entryId) {
    try {
      const { data, error } = await supabase
        .from('voice_log_entries')
        .update({ status: 'rejected' })
        .eq('id', entryId)
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        sessionId: data.session_id ?? undefined,
        rawTranscript: data.raw_transcript,
        status: data.status,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },
};

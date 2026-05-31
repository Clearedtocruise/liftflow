import { api } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IVoiceService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';
import type { ParseVoiceRequest, ParsedVoiceCommand } from '@/types';

function parseCoachingLocally(transcript: string): ParsedVoiceCommand | null {
  const text = transcript.trim().toLowerCase();

  if (/^(?:completed|finished)\s+(?:the\s+)?set\.?$/.test(text)) {
    return { intent: 'completed_set', rawText: transcript, confidence: 0.92 };
  }
  const gotReps = text.match(/^(?:got|did|hit)\s+(\d+)\s*reps?\.?$/);
  if (gotReps) {
    return { intent: 'log_set', reps: parseInt(gotReps[1], 10), rawText: transcript, confidence: 0.88 };
  }
  const easy = text.match(/^(.+?)\s+(?:felt|feels?)\s+easy\.?$/);
  if (easy) {
    return { intent: 'feedback', exercise: easy[1].trim(), feedback: 'easy', rawText: transcript, confidence: 0.9 };
  }
  const hard = text.match(/^(.+?)\s+(?:felt|feels?)\s+(?:hard|heavy)\.?$/);
  if (hard) {
    return { intent: 'feedback', exercise: hard[1].trim(), feedback: 'hard', rawText: transcript, confidence: 0.9 };
  }
  const failed = text.match(/^(?:failed|missed)\s+(?:at\s+)?(\d+)\s*reps?\.?$/);
  if (failed) {
    return {
      intent: 'feedback',
      feedback: 'failed',
      reps: parseInt(failed[1], 10),
      rawText: transcript,
      confidence: 0.9,
    };
  }
  if (/^(?:increase|add|go up)\s+(?:the\s+)?weight\.?$/.test(text)) {
    return { intent: 'adjust_weight', weightAdjustment: 'increase', rawText: transcript, confidence: 0.92 };
  }
  if (/^(?:reduce|decrease|lower|drop)\s+(?:the\s+)?weight\.?$/.test(text)) {
    return { intent: 'adjust_weight', weightAdjustment: 'decrease', rawText: transcript, confidence: 0.92 };
  }

  return null;
}

function parseLocally(transcript: string): ParsedVoiceCommand | null {
  const coaching = parseCoachingLocally(transcript);
  if (coaching) return coaching;

  const text = transcript.trim().toLowerCase();

  const patterns = [
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)/i,
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s+(?<reps>\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.groups) {
      return {
        exercise: match.groups.exercise.trim(),
        weight: parseFloat(match.groups.weight),
        reps: parseInt(match.groups.reps, 10),
        rawText: transcript,
        confidence: 0.85,
      };
    }
  }

  const simpleReps = text.match(/^(?<exercise>.+?)\s+(?<reps>\d+)\s*reps?$/i);
  if (simpleReps?.groups) {
    return {
      exercise: simpleReps.groups.exercise.trim(),
      reps: parseInt(simpleReps.groups.reps, 10),
      rawText: transcript,
      confidence: 0.7,
    };
  }

  return null;
}

export const voiceService: IVoiceService = {
  async parseCommand(request: ParseVoiceRequest) {
    try {
      const local = parseLocally(request.transcript);
      if (local && (local.confidence ?? 0) >= 0.8) {
        return ok({
          parsed: local,
          confidence: local.confidence ?? 0.85,
          requiresConfirmation: false,
        });
      }

      try {
        const remote = await api.parseVoice(request);
        return ok(remote);
      } catch {
        if (local) {
          return ok({
            parsed: local,
            confidence: local.confidence ?? 0.6,
            requiresConfirmation: true,
            confirmationReason: 'Low confidence parse — please confirm',
          });
        }
        return fail('Could not parse voice command. Try: "Bench press 225 for 8"');
      }
    } catch (e) {
      return fromError(e);
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

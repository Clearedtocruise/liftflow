import { Router } from 'express';

import { supabaseAdmin } from '../lib/supabase.js';
import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    parseWithOpenAI,
    type VoiceParseContext,
} from '../lib/voiceParser.js';
import { requireUser, type AuthedRequest } from '../middleware/authUser.js';

export const voiceWorkoutRouter = Router();

type WorkoutVoiceIntent =
  | 'LOG_SET'
  | 'LOG_BODYWEIGHT_SET'
  | 'START_REST_TIMER'
  | 'NEXT_EXERCISE'
  | 'PREVIOUS_EXERCISE'
  | 'FINISH_WORKOUT'
  | 'ASK_STATUS'
  | 'CANCEL'
  | 'UNKNOWN';

type ParsedWorkoutCommand = {
  intent: WorkoutVoiceIntent;
  exerciseName?: string;
  replacementExerciseName?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  unit?: 'lb' | 'kg' | 'bodyweight';
  rawText: string;
  confidence: number;
};

function mapParsedIntent(parsed: ReturnType<typeof enrichParsedCommand>): ParsedWorkoutCommand {
  const rawText = parsed.rawText;
  const confidence = parsed.confidence ?? 0.7;

  if (parsed.intent === 'next_set') {
    return { intent: 'NEXT_EXERCISE', rawText, confidence };
  }

  if (parsed.intent === 'undo_last_set' || parsed.intent === 'delete_last_set') {
    return { intent: 'CANCEL', rawText, confidence };
  }

  if (parsed.reps != null && parsed.exercise) {
    return {
      intent: parsed.weight != null ? 'LOG_SET' : 'LOG_BODYWEIGHT_SET',
      exerciseName: parsed.exercise,
      weight: parsed.weight ?? parsed.targetWeight,
      reps: parsed.reps,
      unit: parsed.weightUnit ?? (parsed.weight != null ? 'lb' : 'bodyweight'),
      rawText,
      confidence,
    };
  }

  return { intent: 'UNKNOWN', rawText, confidence: 0.1 };
}

/**
 * Parses workout voice commands server-side.
 * Set logging is executed on the phone via WorkoutSessionContext for live session state.
 */
voiceWorkoutRouter.post('/voice-command', requireUser, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId;
    const { activeWorkoutId, activeExerciseId, command, transcript, context } = req.body as {
      activeWorkoutId?: string;
      activeExerciseId?: string;
      command?: ParsedWorkoutCommand;
      transcript?: string;
      context?: VoiceParseContext;
    };

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let resolved = command;
    if (!resolved?.intent && transcript?.trim()) {
      const ctx = context ?? {};
      const local = parseVoiceTranscript(transcript, ctx);
      const enriched = local ? enrichParsedCommand(local, ctx) : null;
      let parsed = enriched;
      if (!parsed || (parsed.confidence ?? 0) < 0.88) {
        const remote = await parseWithOpenAI(transcript, ctx);
        const fallback = remote ?? parsed ?? parseVoiceTranscript(transcript, ctx);
        if (!fallback) {
          res.status(422).json({ error: 'Could not parse transcript' });
          return;
        }
        parsed = enrichParsedCommand(fallback, ctx);
      }
      if (parsed) {
        resolved = mapParsedIntent(parsed);
      }
    }

    if (!resolved?.intent) {
      res.status(400).json({ error: 'Missing command' });
      return;
    }

    if (resolved.intent === 'UNKNOWN') {
      res.json({ success: false, message: 'Unknown voice command', command: resolved });
      return;
    }

    if (!activeWorkoutId) {
      res.status(400).json({ error: 'Missing activeWorkoutId' });
      return;
    }

    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Database not configured' });
      return;
    }
    const db = supabaseAdmin;

    if (resolved.intent === 'LOG_SET' || resolved.intent === 'LOG_BODYWEIGHT_SET') {
      if (!resolved.reps) {
        res.status(400).json({ error: 'Missing reps' });
        return;
      }

      let workoutExerciseId = activeExerciseId;
      if (!workoutExerciseId && resolved.exerciseName) {
        const { data: exercises } = await db
          .from('workout_exercises')
          .select('id, exercises(name)')
          .eq('session_id', activeWorkoutId);

        const match = (exercises ?? []).find((row) => {
          const name = (row.exercises as { name?: string } | null)?.name?.toLowerCase() ?? '';
          return name.includes(resolved.exerciseName!.toLowerCase());
        });
        workoutExerciseId = match?.id;
      }

      if (!workoutExerciseId) {
        res.status(400).json({ error: 'Could not resolve workout exercise' });
        return;
      }

      const { data: existingSets } = await db
        .from('workout_sets')
        .select('set_number')
        .eq('workout_exercise_id', workoutExerciseId)
        .order('set_number', { ascending: false })
        .limit(1);

      const setNumber = (existingSets?.[0]?.set_number ?? 0) + 1;
      const weightKg =
        resolved.weight != null
          ? resolved.unit === 'kg'
            ? resolved.weight
            : resolved.weight / 2.2046226218
          : null;

      const { data, error } = await db
        .from('workout_sets')
        .insert({
          workout_exercise_id: workoutExerciseId,
          set_number: setNumber,
          weight: weightKg,
          reps: resolved.reps,
          set_type: 'normal',
          metadata: { source: 'voice', rawText: resolved.rawText },
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({
        success: true,
        message: 'Set logged',
        set: data,
        shouldStartRestTimer: true,
        command: resolved,
      });
      return;
    }

    if (resolved.intent === 'START_REST_TIMER') {
      res.json({
        success: true,
        message: 'Rest timer started',
        durationSeconds: resolved.durationSeconds ?? 90,
        command: resolved,
      });
      return;
    }

    if (resolved.intent === 'FINISH_WORKOUT') {
      const { error } = await db
        .from('workout_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', activeWorkoutId)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ success: true, message: 'Workout finished', command: resolved });
      return;
    }

    res.json({
      success: true,
      message: `Acknowledged ${resolved.intent}`,
      command: resolved,
      clientExecute: true,
    });
  } catch (error) {
    console.error('[voice-workout] command failed', error);
    res.status(500).json({ error: 'Failed to process voice command' });
  }
});

/** Parse-only helper for integrations that do not execute locally. */
voiceWorkoutRouter.post('/voice-command/parse', async (req, res) => {
  try {
    const { transcript, context } = req.body as { transcript?: string; context?: VoiceParseContext };
    if (!transcript?.trim()) {
      res.status(400).json({ message: 'transcript is required' });
      return;
    }
    const ctx = context ?? {};
    const local = parseVoiceTranscript(transcript, ctx);
    const enrichedLocal = local ? enrichParsedCommand(local, ctx) : null;
    if (enrichedLocal && (enrichedLocal.confidence ?? 0) >= 0.88) {
      res.json(buildParseResponse(enrichedLocal, ctx));
      return;
    }
    const remote = await parseWithOpenAI(transcript, ctx);
    const fallback = remote ?? enrichedLocal ?? parseVoiceTranscript(transcript, ctx);
    if (!fallback) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }
    res.json(buildParseResponse(enrichParsedCommand(fallback, ctx), ctx));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Parse failed' });
  }
});

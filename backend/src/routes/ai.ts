import { Router } from 'express';

import {
    assessRecovery,
    coachResponse,
    generateRecommendations,
    generateWeeklyMealPlan,
    generateWorkoutPlan,
    suggestMuscleGroups,
    synthesizeSpeech,
} from '../lib/aiCoach.js';
import { captureAiError } from '../lib/aiErrorReporting.js';
import {
    converseWithCoach,
    loadConversationalCoachHistory,
} from '../lib/conversationalCoachEngine.js';
import { requireAdmin } from '../lib/supabase.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';

export const aiRouter = Router();

function getUserId(req: { body?: { userId?: string }; query?: { userId?: string } }): string | undefined {
  return req.body?.userId ?? (req.query?.userId as string | undefined);
}

aiRouter.post('/coach', requireProSubscription, async (req, res) => {
  try {
    const { context = 'general', message = '', userId } = req.body as {
      context?: string;
      message?: string;
      userId?: string;
    };

    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const result = await coachResponse(context, message, userId);
    res.json(result);
  } catch (error) {
    captureAiError(error, '/api/ai/coach', getUserId(req));
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach failed' });
  }
});

aiRouter.post('/converse', requireProSubscription, async (req, res) => {
  try {
    const { userId, message, context, includeHistory, detailLevel } = req.body as {
      userId?: string;
      message?: string;
      context?: string;
      includeHistory?: boolean;
      detailLevel?: 'short' | 'detailed' | 'voice';
    };

    if (!userId || !message?.trim()) {
      res.status(400).json({ message: 'userId and message are required' });
      return;
    }

    const result = await converseWithCoach(userId, message.trim(), {
      context,
      includeHistory,
      detailLevel,
    });
    res.json(result);
  } catch (error) {
    captureAiError(error, '/api/ai/converse', getUserId(req));
    res.status(500).json({ message: error instanceof Error ? error.message : 'Conversational coach failed' });
  }
});

aiRouter.get('/converse/history', requireProSubscription, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

    const limit = Number(req.query.limit ?? 20);
    const history = await loadConversationalCoachHistory(userId, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach history failed' });
  }
});

aiRouter.get('/recommendations', requireProSubscription, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

    const recommendations = await generateRecommendations(userId);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recommendations failed' });
  }
});

aiRouter.post('/refresh', requireProSubscription, async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const recommendations = await generateRecommendations(userId);
    const db = requireAdmin();

    for (const rec of recommendations) {
      await db.from('ai_recommendations').insert({
        user_id: userId,
        recommendation_type: rec.recommendationType,
        title: rec.title,
        description: rec.description,
        rationale: rec.rationale,
        payload: rec.payload,
        confidence: rec.confidence,
      });
    }

    res.json({ count: recommendations.length, recommendations });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Refresh failed' });
  }
});

aiRouter.get('/progression/:exerciseId', async (req, res) => {
  try {
    const db = requireAdmin();
    const { exerciseId } = req.params;

    const { data: sets } = await db
      .from('workout_sets')
      .select('weight, reps, logged_at, workout_exercises!inner(exercise_id, exercises(name))')
      .eq('workout_exercises.exercise_id', exerciseId)
      .order('logged_at', { ascending: false })
      .limit(5);

    const latest = sets?.[0];
    const lastWeight = Number(latest?.weight ?? 0);
    const lastReps = Number(latest?.reps ?? 0);
    const exerciseName =
      (latest as { workout_exercises?: { exercises?: { name?: string } } })?.workout_exercises?.exercises?.name ??
      'Exercise';

    res.json({
      exerciseId,
      exerciseName,
      lastWeight,
      lastReps,
      suggestedWeight: lastWeight > 0 ? lastWeight + 5 : 95,
      suggestedRepRange: '6-8',
      rationale: lastWeight > 0 ? 'Progressive overload: +5 lbs when prior sets were completed.' : 'Start with a manageable working weight.',
      confidence: 0.8,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Progression failed' });
  }
});

aiRouter.post('/workout/generate', requireProSubscription, async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const plan = await generateWorkoutPlan(userId);
    const db = requireAdmin();

    const { data, error } = await db
      .from('planned_workouts')
      .insert({
        user_id: userId,
        name: plan.name,
        scheduled_date: new Date().toISOString().slice(0, 10),
        status: 'planned',
        suggested_muscle_groups: plan.muscleGroups,
        ai_rationale: plan.rationale,
        metadata: { exercises: plan.exercises, estimatedMinutes: plan.estimatedMinutes, aiGenerated: plan.aiGenerated },
      })
      .select('*')
      .single();

    if (error) throw error;

    res.json({ ...plan, id: data.id, scheduledDate: data.scheduled_date });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout generation failed' });
  }
});

aiRouter.post('/tts', requireProSubscription, async (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      res.status(400).json({ message: 'text is required' });
      return;
    }

    const audio = await synthesizeSpeech(text.trim());
    if (!audio) {
      res.status(503).json({ message: 'OpenAI TTS unavailable — client will use device speech' });
      return;
    }

    res.json({ audioBase64: audio.toString('base64'), format: 'mp3' });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'TTS failed' });
  }
});

export { assessRecovery, generateWeeklyMealPlan, suggestMuscleGroups };


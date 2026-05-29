import { Router } from 'express';

import {
    assessRecovery,
    coachResponse,
    generateRecommendations,
    generateWeeklyMealPlan,
    suggestMuscleGroups,
} from '../lib/aiCoach.js';
import { requireAdmin } from '../lib/supabase.js';

export const aiRouter = Router();

function getUserId(req: { body?: { userId?: string }; query?: { userId?: string } }): string | undefined {
  return req.body?.userId ?? (req.query?.userId as string | undefined);
}

aiRouter.post('/coach', async (req, res) => {
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
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach failed' });
  }
});

aiRouter.get('/recommendations', async (req, res) => {
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

aiRouter.post('/refresh', async (req, res) => {
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

export { assessRecovery, generateWeeklyMealPlan, suggestMuscleGroups };


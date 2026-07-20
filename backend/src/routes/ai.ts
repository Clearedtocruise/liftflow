import { Router } from 'express';

import {
    generateExplainWorkoutAdvisory,
    generateMealAlternatives,
    generateNutritionAdvisory,
    generateWorkoutAdvisory,
    type AdvisoryNutritionKind,
    type AdvisoryWorkoutKind,
    type MealReplacementReason,
} from '../lib/advisoryCoach.js';
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
import { generateExerciseAlternatives } from '../lib/exerciseReplacementEngine.js';
import { searchExercisesOnline } from '../lib/exerciseOnlineSearch.js';
import { estimateFoodMacros } from '../lib/foodMacroEstimator.js';
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

aiRouter.post('/advisory/nutrition/meal-alternatives', async (req, res) => {
  try {
    const { mealName, reason, mealType, ingredients, dietaryRestrictions } = req.body as {
      mealName?: string;
      reason?: MealReplacementReason;
      mealType?: string;
      ingredients?: Array<{ name: string; serving: string }>;
      dietaryRestrictions?: string[];
    };

    if (!mealName || !reason) {
      res.status(400).json({ message: 'mealName and reason are required' });
      return;
    }

    const data = await generateMealAlternatives({
      mealName,
      reason,
      mealType,
      ingredients,
      dietaryRestrictions,
    });
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/nutrition/meal-alternatives');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Meal alternatives failed' });
  }
});

aiRouter.post('/advisory/nutrition/food-macros', async (req, res) => {
  try {
    const { foodName, servingSize } = req.body as {
      foodName?: string;
      servingSize?: string;
    };

    if (!foodName?.trim() || !servingSize?.trim()) {
      res.status(400).json({ message: 'foodName and servingSize are required' });
      return;
    }

    const data = await estimateFoodMacros(foodName.trim(), servingSize.trim());
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/nutrition/food-macros');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Food macro estimate failed' });
  }
});

aiRouter.post('/advisory/workout/exercise-alternatives', async (req, res) => {
  try {
    const { userId, exerciseName, muscleGroups, goal, programType, availableEquipment } = req.body as {
      userId?: string;
      exerciseName?: string;
      muscleGroups?: string[];
      goal?: string;
      programType?: string;
      availableEquipment?: string[];
    };

    if (!userId || !exerciseName) {
      res.status(400).json({ message: 'userId and exerciseName are required' });
      return;
    }

    const data = await generateExerciseAlternatives({
      userId,
      exerciseName,
      muscleGroups,
      goal,
      programType,
      availableEquipment,
    });
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/workout/exercise-alternatives');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Exercise alternatives failed' });
  }
});

aiRouter.post('/exercises/search', async (req, res) => {
  try {
    const { query, limit, availableEquipment } = req.body as {
      query?: string;
      limit?: number;
      availableEquipment?: string[];
    };

    if (!query || !query.trim()) {
      res.status(400).json({ message: 'query is required' });
      return;
    }

    const suggestions = await searchExercisesOnline({
      query: query.trim(),
      limit,
      availableEquipment,
    });
    res.json({ data: { suggestions } });
  } catch (error) {
    captureAiError(error, '/api/ai/exercises/search');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Exercise search failed' });
  }
});

aiRouter.post('/advisory/nutrition', async (req, res) => {
  try {
    const { kind, context } = req.body as {
      kind?: AdvisoryNutritionKind;
      context?: Record<string, unknown>;
    };

    if (!kind || !context) {
      res.status(400).json({ message: 'kind and context are required' });
      return;
    }

    const data = await generateNutritionAdvisory(kind, context);
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/nutrition');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Nutrition advisory failed' });
  }
});

aiRouter.post('/advisory/workout', async (req, res) => {
  try {
    const { kind, context } = req.body as {
      kind?: AdvisoryWorkoutKind;
      context?: Record<string, unknown>;
    };

    if (!kind || !context) {
      res.status(400).json({ message: 'kind and context are required' });
      return;
    }

    const data = await generateWorkoutAdvisory(kind, context);
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/workout');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout advisory failed' });
  }
});

aiRouter.post('/advisory/workout/explain', async (req, res) => {
  try {
    const { context } = req.body as { context?: Record<string, unknown> };

    if (!context) {
      res.status(400).json({ message: 'context is required' });
      return;
    }

    const data = await generateExplainWorkoutAdvisory(context);
    res.json({ data });
  } catch (error) {
    captureAiError(error, '/api/ai/advisory/workout/explain');
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout explain failed' });
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


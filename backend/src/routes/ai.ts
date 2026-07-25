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
import { loadUserToday } from '../lib/dailyMacroInputs.js';
import { generateExerciseAlternatives } from '../lib/exerciseReplacementEngine.js';
import { searchExercisesOnline } from '../lib/exerciseOnlineSearch.js';
import { estimateFoodMacros } from '../lib/foodMacroEstimator.js';
import { requireAdmin } from '../lib/supabase.js';
import { authedUserId } from '../middleware/authUser.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';

export const aiRouter = Router();

aiRouter.post('/coach', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { context = 'general', message = '' } = req.body as {
      context?: string;
      message?: string;
    };

    const result = await coachResponse(context, message, userId);
    res.json(result);
  } catch (error) {
    captureAiError(error, '/api/ai/coach', req.userId);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach failed' });
  }
});

aiRouter.post('/converse', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { message, context, includeHistory, detailLevel } = req.body as {
      message?: string;
      context?: string;
      includeHistory?: boolean;
      detailLevel?: 'short' | 'detailed' | 'voice';
    };

    if (!message?.trim()) {
      res.status(400).json({ message: 'message is required' });
      return;
    }

    const result = await converseWithCoach(userId, message.trim(), {
      context,
      includeHistory,
      detailLevel,
    });
    res.json(result);
  } catch (error) {
    captureAiError(error, '/api/ai/converse', req.userId);
    res.status(500).json({ message: error instanceof Error ? error.message : 'Conversational coach failed' });
  }
});

aiRouter.get('/converse/history', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const limit = Number(req.query.limit ?? 20);
    const history = await loadConversationalCoachHistory(userId, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach history failed' });
  }
});

aiRouter.get('/recommendations', requireProSubscription, async (req, res) => {
  try {
    const recommendations = await generateRecommendations(authedUserId(req));
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recommendations failed' });
  }
});

aiRouter.post('/refresh', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const recommendations = await generateRecommendations(userId);
    const db = requireAdmin();

    const { data: inserted, error } = await db
      .from('ai_recommendations')
      .insert(
        recommendations.map((rec) => ({
          user_id: userId,
          recommendation_type: rec.recommendationType,
          title: rec.title,
          description: rec.description,
          rationale: rec.rationale,
          payload: rec.payload,
          confidence: rec.confidence,
        })),
      )
      .select('id');

    // Reporting a count while the writes silently failed made "refresh" look successful.
    if (error) throw error;

    res.json({ count: inserted?.length ?? 0, recommendations });
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
      .select(
        'weight, reps, logged_at, workout_exercises!inner(exercise_id, exercises(name), workout_sessions!inner(user_id))',
      )
      .eq('workout_exercises.exercise_id', exerciseId)
      .eq('workout_exercises.workout_sessions.user_id', authedUserId(req))
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
    const userId = authedUserId(req);
    const [plan, { today }] = await Promise.all([generateWorkoutPlan(userId), loadUserToday(userId)]);
    const db = requireAdmin();

    const { data, error } = await db
      .from('planned_workouts')
      .insert({
        user_id: userId,
        name: plan.name,
        scheduled_date: today,
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
    const userId = authedUserId(req);
    const { exerciseName, muscleGroups, goal, programType, availableEquipment } = req.body as {
      exerciseName?: string;
      muscleGroups?: string[];
      goal?: string;
      programType?: string;
      availableEquipment?: string[];
    };

    if (!exerciseName) {
      res.status(400).json({ message: 'exerciseName is required' });
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


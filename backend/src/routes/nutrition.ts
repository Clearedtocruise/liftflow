import { Router } from 'express';

import { generateWeeklyMealPlan } from '../lib/aiCoach.js';
import { loadCoachContext } from '../lib/coachContext.js';
import { loadNutritionIntelligence } from '../lib/loadNutritionIntelligence.js';
import { requireAdmin } from '../lib/supabase.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';
import { resolveRankedGoals, toNutritionGoal } from '../lib/trainingGoals.js';
import {
    calculateMacroTargets,
    generateDailyMeals,
    inferWorkoutType,
} from '../lib/workoutAwareNutrition.js';

export const nutritionRouter = Router();

nutritionRouter.get('/intelligence', requireProSubscription, async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    const report = await loadNutritionIntelligence(userId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Nutrition intelligence failed' });
  }
});

nutritionRouter.post('/meal-plan/generate', async (req, res) => {
  try {
    const { userId, dietaryStyle } = req.body as { userId?: string; dietaryStyle?: string };
    let proteinG = 180;
    let calories = 2400;

    if (userId) {
      const ctx = await loadCoachContext(userId);
      if (ctx.macroTargets) {
        proteinG = ctx.macroTargets.proteinG;
        calories = ctx.macroTargets.calories;
      } else {
        const db = requireAdmin();
        const { data: goals } = await db
          .from('nutrition_goals')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (goals) {
          proteinG = goals.protein_g ?? proteinG;
          calories = goals.daily_calories ?? calories;
        }
      }
    }

    const plan = generateWeeklyMealPlan(proteinG, calories);
    if (dietaryStyle && userId) {
      plan.aiRationale = `${plan.aiRationale} Style: ${dietaryStyle}.`;
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Meal plan generation failed' });
  }
});

nutritionRouter.post('/adaptive-targets', async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string; dietaryStyle?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const ctx = await loadCoachContext(userId);
    const muscleGroups = ctx.plannedWorkout?.muscleGroups ?? [];
    const workoutType = muscleGroups.length ? inferWorkoutType(muscleGroups) : 'rest';

    const db = requireAdmin();
    const { data: profile } = await db
      .from('profiles')
      .select('weight_kg, primary_training_goal, fitness_goals')
      .eq('id', userId)
      .maybeSingle();

    const ranked = resolveRankedGoals(profile?.fitness_goals, profile?.primary_training_goal);

    const targets = calculateMacroTargets({
      goal: toNutritionGoal(ranked[0]),
      bodyWeightKg: profile?.weight_kg ?? undefined,
      recoveryScore: ctx.recovery.score,
      recoveryModeActive: ctx.recovery.recoveryModeActive,
      workoutType,
      isTrainingDay: !!ctx.plannedWorkout,
      dietaryStyle: (req.body as { dietaryStyle?: string }).dietaryStyle as 'balanced' | undefined,
    });

    res.json({ ...targets, workoutType, recoveryScore: ctx.recovery.score });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Adaptive targets failed' });
  }
});

nutritionRouter.post('/daily-plan', async (req, res) => {
  try {
    const { userId, date, dietaryStyle } = req.body as {
      userId?: string;
      date?: string;
      dietaryStyle?: 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' | 'balanced';
    };

    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const ctx = await loadCoachContext(userId);
    const macros =
      ctx.macroTargets ??
      calculateMacroTargets({
        goal: 'general_fitness',
        recoveryScore: ctx.recovery.score,
        recoveryModeActive: ctx.recovery.recoveryModeActive,
      });

    const meals = generateDailyMeals(targetDate, macros, dietaryStyle ?? 'balanced');

    res.json({
      date: targetDate,
      macros,
      meals,
      rationale: macros.rationale,
      recoveryScore: ctx.recovery.score,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Daily plan failed' });
  }
});

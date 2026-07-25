import { Router } from 'express';

import { generateWeeklyMealPlan } from '../lib/aiCoach.js';
import { ageYearsFromDateOfBirth } from '../lib/ageAdjustments.js';
import { loadCoachContext } from '../lib/coachContext.js';
import { loadNutritionIntelligence } from '../lib/loadNutritionIntelligence.js';
import { syncNutritionForDates } from '../lib/nutritionDaySync.js';
import { requireAdmin } from '../lib/supabase.js';
import { resolveRankedGoals, toNutritionGoal } from '../lib/trainingGoals.js';
import {
    calculateMacroTargets,
    generateDailyMeals,
    inferWorkoutType,
} from '../lib/workoutAwareNutrition.js';
import { inferDietaryStyle, type NutritionPreferenceInput } from '../lib/dietaryRestrictions.js';
import { authedUserId } from '../middleware/authUser.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';

export const nutritionRouter = Router();

const DIETARY_STYLES = ['balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean', 'vegetarian'] as const;
type DietaryStyleName = (typeof DIETARY_STYLES)[number];

function isDietaryStyle(value: unknown): value is DietaryStyleName {
  return DIETARY_STYLES.includes(value as DietaryStyleName);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Restrictions the client sends win; otherwise fall back to the saved coach
 * profile so generation honours them even when the caller omits them.
 */
async function resolveNutritionPreferences(
  userId: string,
  dietaryRestrictions?: string[],
  foodPreferences?: string[],
): Promise<NutritionPreferenceInput> {
  const fromRequest = {
    dietaryRestrictions: stringList(dietaryRestrictions),
    foodPreferences: stringList(foodPreferences),
  };
  if (fromRequest.dietaryRestrictions.length > 0 || fromRequest.foodPreferences.length > 0) return fromRequest;

  const { data: profile } = await requireAdmin()
    .from('profiles')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();

  const coachProfile = (profile?.metadata as { coachProfile?: Record<string, unknown> } | null)?.coachProfile ?? {};
  return {
    dietaryRestrictions: stringList(coachProfile.dietaryRestrictions),
    foodPreferences: stringList(coachProfile.foodPreferences),
  };
}

nutritionRouter.get('/intelligence', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const report = await loadNutritionIntelligence(userId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Nutrition intelligence failed' });
  }
});

nutritionRouter.post('/meal-plan/generate', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { dietaryStyle, dietaryRestrictions, foodPreferences } = req.body as {
      dietaryStyle?: string;
      dietaryRestrictions?: string[];
      foodPreferences?: string[];
    };
    let proteinG = 180;
    let calories = 2400;

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
    try {
      const ctx = await loadCoachContext(userId);
      if (ctx.macroTargets) {
        proteinG = ctx.macroTargets.proteinG;
        calories = ctx.macroTargets.calories;
      }
    } catch {
      // Keep goals/defaults — never fail meal generation on coach context.
    }

    const prefs = await resolveNutritionPreferences(userId, dietaryRestrictions, foodPreferences);
    const resolvedStyle =
      (dietaryStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' | undefined)
      ?? inferDietaryStyle(prefs.dietaryRestrictions);

    const plan = generateWeeklyMealPlan(proteinG, calories, resolvedStyle, prefs);
    if (plan.aiRationale && !plan.aiRationale.includes('Style:')) {
      plan.aiRationale = `${plan.aiRationale} Style: ${resolvedStyle}.`;
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Meal plan generation failed' });
  }
});

nutritionRouter.post('/adaptive-targets', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { dietaryStyle, dietaryRestrictions } = req.body as {
      dietaryStyle?: string;
      dietaryRestrictions?: string[];
    };

    const ctx = await loadCoachContext(userId);
    const muscleGroups = ctx.plannedWorkout?.muscleGroups ?? [];
    const workoutType = muscleGroups.length ? inferWorkoutType(muscleGroups) : 'rest';

    const db = requireAdmin();
    const { data: profile } = await db
      .from('profiles')
      .select('weight_kg, primary_training_goal, fitness_goals, date_of_birth')
      .eq('id', userId)
      .maybeSingle();

    const ranked = resolveRankedGoals(profile?.fitness_goals, profile?.primary_training_goal);
    const adaptiveStyle = isDietaryStyle(dietaryStyle)
      ? dietaryStyle
      : inferDietaryStyle((await resolveNutritionPreferences(userId, dietaryRestrictions)).dietaryRestrictions);

    const targets = calculateMacroTargets({
      goal: toNutritionGoal(ranked[0]),
      bodyWeightKg: profile?.weight_kg ?? undefined,
      ageYears: ageYearsFromDateOfBirth(profile?.date_of_birth),
      recoveryScore: ctx.recovery.score,
      recoveryModeActive: ctx.recovery.recoveryModeActive,
      workoutType,
      isTrainingDay: !!ctx.plannedWorkout,
      dietaryStyle: adaptiveStyle,
    });

    res.json({ ...targets, workoutType, recoveryScore: ctx.recovery.score });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Adaptive targets failed' });
  }
});

nutritionRouter.post('/sync-dates', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { dates } = req.body as { dates?: string[] };
    if (!Array.isArray(dates) || dates.length === 0) {
      res.status(400).json({ message: 'dates[] is required' });
      return;
    }

    const results = await syncNutritionForDates(userId, dates);
    res.json({ synced: results.length, results });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Nutrition sync failed' });
  }
});

nutritionRouter.post('/daily-plan', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { date, dietaryStyle } = req.body as {
      date?: string;
      dietaryStyle?: 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' | 'balanced';
    };

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

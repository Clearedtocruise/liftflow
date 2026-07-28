import { Router } from 'express';

import { generateWeeklyMealPlan } from '../lib/aiCoach.js';
import { loadCoachContext } from '../lib/coachContext.js';
import { loadDailyMacroInputs, macroContextFrom } from '../lib/dailyMacroInputs.js';
import { loadNutritionIntelligence } from '../lib/loadNutritionIntelligence.js';
import { syncNutritionForDates } from '../lib/nutritionDaySync.js';
import { requireAdmin } from '../lib/supabase.js';
import {
    calculateMacroTargets,
    generateDailyMeals,
    isInvertedBodyWeightKg,
    normalizeBodyWeightKg,
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
    let goalCalories: number | null = null;
    let goalProtein: number | null = null;

    const db = requireAdmin();
    const { data: goals } = await db
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (goals) {
      goalProtein = goals.protein_g ?? null;
      goalCalories = goals.daily_calories ?? null;
      proteinG = goalProtein ?? proteinG;
      calories = goalCalories ?? calories;
    }

    // Persist lbs×2.2 weight inversions so the next generate/sync stays correct.
    try {
      const { data: profile } = await db.from('profiles').select('weight_kg').eq('id', userId).maybeSingle();
      const rawWeight = profile?.weight_kg != null ? Number(profile.weight_kg) : null;
      if (isInvertedBodyWeightKg(rawWeight)) {
        await db.from('profiles').update({ weight_kg: normalizeBodyWeightKg(rawWeight) }).eq('id', userId);
      }
    } catch {
      // Non-fatal — meal generation still proceeds with clamped targets.
    }

    let today: string | undefined;
    try {
      const ctx = await loadCoachContext(userId);
      today = ctx.today;
      if (ctx.macroTargets) {
        const coachCal = ctx.macroTargets.calories;
        const goalsLookSane = goalCalories != null && goalCalories >= 1200 && goalCalories <= 4500;
        // Prefer active goals when coach macros still look like the weight-unit bug
        // (header can show 2241 while generate would otherwise write 11k-day meals).
        const coachLooksInflated =
          coachCal > 4500 || (goalsLookSane && coachCal > goalCalories! * 1.5);
        if (!coachLooksInflated) {
          proteinG = ctx.macroTargets.proteinG;
          calories = ctx.macroTargets.calories;
        }
      }
    } catch {
      // Keep goals/defaults — never fail meal generation on coach context.
    }

    // Inflated goals (from a bad weight_kg) must not ship 3k-calorie dinners.
    if (calories > 4500) {
      const scale = 4500 / calories;
      calories = 4500;
      proteinG = Math.round(proteinG * scale);
    }
    if (calories < 1200) calories = 1200;

    const prefs = await resolveNutritionPreferences(userId, dietaryRestrictions, foodPreferences);
    const resolvedStyle =
      (dietaryStyle as 'balanced' | 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' | undefined)
      ?? inferDietaryStyle(prefs.dietaryRestrictions);

    const plan = generateWeeklyMealPlan(proteinG, calories, resolvedStyle, prefs, today);
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

    const [ctx, macroInputs] = await Promise.all([loadCoachContext(userId), loadDailyMacroInputs(userId)]);

    const adaptiveStyle = isDietaryStyle(dietaryStyle)
      ? dietaryStyle
      : inferDietaryStyle((await resolveNutritionPreferences(userId, dietaryRestrictions)).dietaryRestrictions);

    const macroContext = macroContextFrom(macroInputs, {
      recoveryScore: ctx.recovery.score,
      recoveryModeActive: ctx.recovery.recoveryModeActive,
      dietaryStyle: adaptiveStyle,
    });
    const targets = calculateMacroTargets(macroContext);

    res.json({ ...targets, workoutType: macroContext.workoutType, recoveryScore: ctx.recovery.score });
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

    const ctx = await loadCoachContext(userId);
    const targetDate = date ?? ctx.today;
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

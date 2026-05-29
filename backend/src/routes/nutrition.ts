import { Router } from 'express';

import { generateWeeklyMealPlan } from '../lib/aiCoach.js';
import { requireAdmin } from '../lib/supabase.js';

export const nutritionRouter = Router();

nutritionRouter.post('/meal-plan/generate', async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    let proteinG = 180;
    let calories = 2400;

    if (userId) {
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

    res.json(generateWeeklyMealPlan(proteinG, calories));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Meal plan generation failed' });
  }
});

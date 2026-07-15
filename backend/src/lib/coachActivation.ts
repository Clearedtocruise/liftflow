import { ageYearsFromDateOfBirth } from './ageAdjustments.js';
import { generateWeeklyMealPlan } from './aiCoach.js';
import { pruneDuplicateMeals, removePlannedMealsForWeek, weekEndDate } from './mealCleanup.js';
import { captureOutcomeBaseline } from './outcomeEngine.js';
import { generateTrainingProgram, getProgramDashboard } from './programEngine.js';
import { inferNutritionGoal, inferProgramFrequency, inferProgramType } from './programSelection.js';
import { requireAdmin } from './supabase.js';
import { recommendSupplements, type SupplementRecommendation } from './supplementGuidance.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import { calculateMacroTargets } from './workoutAwareNutrition.js';

export type CoachProfileMeta = {
  timeline?: 'aggressive' | 'moderate' | 'conservative';
  daysPerWeek?: number;
  minutesPerWorkout?: number;
  preferredWorkoutDays?: string[];
  preferredWorkoutTimes?: string[];
  mealsPerDay?: number;
  foodPreferences?: string[];
  dietaryRestrictions?: string[];
  currentSupplements?: string[];
};

function weekStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function defaultGroceryItems(proteinG: number): string[] {
  const base = [
    'Chicken breast',
    'Eggs',
    'Greek yogurt',
    'Rice',
    'Potatoes',
    'Spinach',
    'Blueberries',
  ];
  if (proteinG >= 160) base.push('Protein powder');
  base.push('Olive oil', 'Bananas', 'Broccoli');
  return base;
}

export async function activateCoachSystem(userId: string) {
  const db = requireAdmin();

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('Profile not found');
  }

  const coachProfile = ((profile.metadata ?? {}) as { coachProfile?: CoachProfileMeta }).coachProfile ?? {};
  const rankedGoals = resolveRankedGoals(profile.fitness_goals, profile.primary_training_goal);
  const primaryGoal = rankedGoals[0];
  const nutritionGoal = toNutritionGoal(primaryGoal);
  const daysPerWeek = coachProfile.daysPerWeek ?? 4;

  const programType = inferProgramType({
    fitnessGoals: rankedGoals,
    primaryGoal,
    experience: profile.training_experience ?? undefined,
    daysPerWeek,
    timeline: coachProfile.timeline,
  });

  const frequency = inferProgramFrequency({
    daysPerWeek,
    fitnessGoals: rankedGoals,
    primaryGoal,
  });

  await generateTrainingProgram({
    userId,
    programType,
    frequency,
    goal: inferNutritionGoal(primaryGoal, rankedGoals),
    experience: profile.training_experience ?? 'intermediate',
    durationWeeks: 12,
    equipment: profile.available_equipment ?? undefined,
  });

  const macroTargets = calculateMacroTargets({
    goal: nutritionGoal,
    bodyWeightKg: profile.weight_kg ?? undefined,
    ageYears: ageYearsFromDateOfBirth(profile.date_of_birth),
    dietaryStyle: coachProfile.dietaryRestrictions?.some((r) => /keto/i.test(r))
      ? 'keto'
      : coachProfile.dietaryRestrictions?.some((r) => /vegetarian/i.test(r))
        ? 'vegetarian'
        : 'balanced',
  });

  if (coachProfile.timeline === 'aggressive') {
    macroTargets.calories = Math.round(macroTargets.calories * 0.95);
    macroTargets.proteinG = Math.round(macroTargets.proteinG * 1.05);
  } else if (coachProfile.timeline === 'conservative') {
    macroTargets.calories = Math.round(macroTargets.calories * 1.02);
  }

  await db.from('nutrition_goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

  const today = new Date().toISOString().slice(0, 10);
  await db.from('nutrition_goals').insert({
    user_id: userId,
    daily_calories: macroTargets.calories,
    protein_g: macroTargets.proteinG,
    carbs_g: macroTargets.carbsG,
    fat_g: macroTargets.fatG,
    water_ml: 3000,
    is_active: true,
    effective_from: today,
  });

  const mealPlan = generateWeeklyMealPlan(macroTargets.proteinG, macroTargets.calories);
  const planWeekStart = mealPlan.weekStartDate ?? weekStartDate();
  const planWeekEnd = weekEndDate(planWeekStart);

  await pruneDuplicateMeals(db, userId);
  await removePlannedMealsForWeek(db, userId, planWeekStart, planWeekEnd);

  const { data: savedPlan } = await db
    .from('meal_plans')
    .insert({
      user_id: userId,
      name: mealPlan.name,
      week_start_date: mealPlan.weekStartDate ?? weekStartDate(),
      ai_generated: true,
      ai_rationale: mealPlan.aiRationale,
    })
    .select('id')
    .single();

  let mealPlanCreated = false;
  if (savedPlan && mealPlan.meals?.length) {
    await db.from('meals').insert(
      mealPlan.meals.map((m) => ({
        meal_plan_id: savedPlan.id,
        user_id: userId,
        meal_type: m.mealType,
        name: m.name,
        scheduled_date: m.scheduledDate,
        calories: m.calories,
        protein_g: m.proteinG,
        carbs_g: m.carbsG,
        fat_g: m.fatG,
      })),
    );
    mealPlanCreated = true;
  }

  const groceryItems = defaultGroceryItems(macroTargets.proteinG);
  const { data: groceryList, error: groceryError } = await db
    .from('grocery_lists')
    .insert({
      user_id: userId,
      name: 'Weekly Grocery List',
      week_start_date: weekStartDate(),
    })
    .select('id')
    .single();

  let groceryListCreated = false;
  if (groceryError) {
    console.error('grocery_lists insert failed:', groceryError.message);
  }
  if (groceryList) {
    await db.from('grocery_list_items').insert(
      groceryItems.map((name, index) => ({
        grocery_list_id: groceryList.id,
        name,
        quantity: 1,
        unit: 'item',
        sort_order: index,
      })),
    );
    groceryListCreated = true;
  }

  const supplementRecommendations: SupplementRecommendation[] = recommendSupplements({
    goal: nutritionGoal,
    bodyWeightKg: profile.weight_kg ?? undefined,
    daysPerWeek,
    currentSupplements: coachProfile.currentSupplements,
    dietaryRestrictions: coachProfile.dietaryRestrictions,
  });

  const programDashboard = await getProgramDashboard(userId);
  const nextWorkout = programDashboard?.nextWorkout as { name?: string } | null;

  const coachMessage = nextWorkout?.name
    ? `Your ${daysPerWeek}-day program is ready. Today: ${nextWorkout.name}. Target ${macroTargets.proteinG}g protein and ${macroTargets.calories} calories.`
    : `Your personalized program is active. Target ${macroTargets.proteinG}g protein daily at ${macroTargets.calories} calories.`;

  const existingMeta = (profile.metadata ?? {}) as Record<string, unknown>;
  await db
    .from('profiles')
    .update({
      metadata: {
        ...existingMeta,
        coachActivation: {
          activatedAt: new Date().toISOString(),
          coachMessage,
          supplementRecommendations,
          programType,
          frequency,
        },
      },
    })
    .eq('id', userId);

  try {
    await captureOutcomeBaseline(userId);
  } catch (baselineErr) {
    console.warn('[coachActivation] outcome baseline capture failed:', baselineErr);
  }

  return {
    programDashboard,
    nutritionGoals: {
      dailyCalories: macroTargets.calories,
      proteinG: macroTargets.proteinG,
      carbsG: macroTargets.carbsG,
      fatG: macroTargets.fatG,
      rationale: macroTargets.rationale,
    },
    coachMessage,
    supplementRecommendations,
    mealPlanCreated,
    groceryListCreated,
  };
}

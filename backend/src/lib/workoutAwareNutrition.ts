export type NutritionContext = {
  goal: 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';
  bodyWeightKg?: number;
  recoveryScore?: number;
  recoveryModeActive?: boolean;
  trainingVolume?: number;
  workoutType?: 'leg' | 'upper' | 'full' | 'cardio' | 'rest' | 'push' | 'pull';
  sessionKind?: 'strength' | 'cardio' | 'mobility';
  isTrainingDay?: boolean;
  dietaryStyle?: 'high_protein' | 'low_carb' | 'keto' | 'mediterranean' | 'vegetarian' | 'balanced';
  /** Whole years from profile date of birth when available. */
  ageYears?: number | null;
};

export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rationale: string;
};

import { ageNutritionAdjustments } from './ageAdjustments.js';
import { selectDailyCoreMeals } from './mealPlanTemplates.js';

export function calculateMacroTargets(ctx: NutritionContext): MacroTargets {
  const bw = ctx.bodyWeightKg ?? 75;
  const bwLbs = bw * 2.20462;
  const ageMods = ageNutritionAdjustments(ctx.ageYears);

  let calories = Math.round(bwLbs * 15);
  let proteinG = Math.round(bw * 2);
  let carbsG = Math.round((calories * 0.4) / 4);
  let fatG = Math.round((calories * 0.25) / 9);
  const notes: string[] = [];
  const maintenanceCalories = calories;

  switch (ctx.goal) {
    case 'fat_loss':
      calories = Math.round(calories * 0.85);
      proteinG = Math.round(bw * 2.2);
      notes.push('Moderate deficit for fat loss');
      break;
    case 'muscle_gain':
      calories = Math.round(calories * 1.1);
      proteinG = Math.round(bw * 2.2);
      carbsG = Math.round((calories * 0.45) / 4);
      notes.push('Calorie surplus for muscle gain');
      break;
    case 'strength':
      proteinG = Math.round(bw * 2);
      carbsG = Math.round((calories * 0.42) / 4);
      notes.push('Strength-focused macro split');
      break;
    default:
      notes.push('Balanced maintenance targets');
  }

  if (ctx.recoveryModeActive || (ctx.recoveryScore != null && ctx.recoveryScore < 40)) {
    proteinG = Math.round(proteinG * 1.15);
    carbsG = Math.round(carbsG * 0.85);
    notes.push('Recovery mode — higher protein, moderate carbs');
  }

  if (ctx.workoutType === 'leg' || ctx.workoutType === 'full') {
    carbsG = Math.round(carbsG * 1.2);
    notes.push('Leg/full day — higher carbs');
  } else if (ctx.workoutType === 'cardio' || ctx.sessionKind === 'cardio') {
    carbsG = Math.round(carbsG * 1.15);
    proteinG = Math.round(proteinG * 0.95);
    notes.push('Cardio day — higher carbs for endurance');
  } else if (ctx.sessionKind === 'mobility') {
    proteinG = Math.round(proteinG * 1.05);
    carbsG = Math.round(carbsG * 0.85);
    notes.push('Recovery session — moderate carbs, elevated protein');
  } else if (ctx.workoutType === 'rest' || ctx.isTrainingDay === false) {
    carbsG = Math.round(carbsG * 0.75);
    fatG = Math.round(fatG * 1.05);
    notes.push('Rest day — lower carbs');
  }

  if (ageMods.proteinMultiplier > 1) {
    proteinG = Math.round(proteinG * ageMods.proteinMultiplier);
  }
  if (ageMods.deficitSoftening > 0 && calories < maintenanceCalories) {
    const gap = maintenanceCalories - calories;
    calories = Math.round(calories + gap * ageMods.deficitSoftening);
  }
  if (ageMods.note) {
    notes.push(ageMods.note);
  }

  let maxCarbsG: number | undefined;
  if (ctx.dietaryStyle === 'keto') {
    maxCarbsG = 50;
    carbsG = Math.min(carbsG, maxCarbsG);
    notes.push('Keto carb cap applied');
  } else if (ctx.dietaryStyle === 'low_carb') {
    carbsG = Math.round(carbsG * 0.6);
    notes.push('Low carb adjustment');
  }

  const reconciled = reconcileMacros({
    calories,
    proteinG,
    carbsG,
    fatG,
    minFatG: Math.round(bw * 0.6),
    maxCarbsG,
  });

  if (reconciled.calories !== calories) {
    notes.push('Calories raised to cover protein and essential fat minimums');
  }

  return {
    calories: reconciled.calories,
    proteinG: reconciled.proteinG,
    carbsG: reconciled.carbsG,
    fatG: reconciled.fatG,
    rationale: notes.join('. ') + '.',
  };
}

/**
 * Force protein/carb/fat grams to actually add up to the calorie target. The
 * ratio-based splits above never subtracted protein's calories, so the grams
 * routinely described a different (larger) intake than the stated target.
 * Protein is treated as fixed, fat has an essential-intake floor, and carbs
 * absorb whatever energy is left.
 */
function reconcileMacros(input: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  minFatG: number;
  maxCarbsG?: number;
}): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  const { proteinG, minFatG, maxCarbsG } = input;
  let calories = input.calories;
  let carbsG = maxCarbsG != null ? Math.min(input.carbsG, maxCarbsG) : input.carbsG;

  let fatG = Math.round((calories - proteinG * 4 - carbsG * 4) / 9);

  if (fatG < minFatG) {
    fatG = minFatG;
    carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);
  }

  if (carbsG < 0) {
    carbsG = 0;
    // Protein and essential fat alone exceed the target, so raise the target
    // rather than reporting grams that contradict the calorie number.
    calories = proteinG * 4 + fatG * 9;
  }

  return { calories, proteinG, carbsG, fatG };
}

export function generateDailyMeals(
  date: string,
  macros: MacroTargets,
  style: NutritionContext['dietaryStyle'] = 'balanced',
) {
  return selectDailyCoreMeals(date, macros, style ?? 'balanced').map((meal) => ({
    ...meal,
    scheduledDate: date,
  }));
}

export function inferWorkoutType(muscleGroups: string[]): NutritionContext['workoutType'] {
  const groups = muscleGroups.map((g) => g.toLowerCase());
  if (groups.some((g) => g.includes('leg') || g.includes('quad') || g.includes('glute'))) return 'leg';
  if (groups.length >= 3) return 'full';
  if (groups.some((g) => g.includes('chest') || g.includes('shoulder') || g.includes('push'))) return 'push';
  if (groups.some((g) => g.includes('back') || g.includes('pull'))) return 'pull';
  return 'upper';
}

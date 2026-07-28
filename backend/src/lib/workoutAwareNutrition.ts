export type NutritionContext = {
  goal: 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';
  bodyWeightKg?: number;
  recoveryScore?: number;
  recoveryModeActive?: boolean;
  /** Sum of completed-session volume over the trailing 7 days. */
  trainingVolume?: number;
  /**
   * The user's own weekly volume over the preceding 4 weeks. Training volume is only
   * meaningful relative to a baseline, so calories move only when both are known.
   */
  trainingVolumeBaseline?: number;
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

/**
 * How far this week's training load sits from the user's own 4-week baseline, expressed as a
 * calorie multiplier. This is the link that makes nutrition genuinely workout-aware: a heavy
 * week raises the energy budget, a deload lowers it. Damped and clamped so a single outlier
 * session cannot swing targets wildly, and inert until a baseline exists.
 */
function trainingVolumeAdjustment(ctx: NutritionContext): { multiplier: number; note?: string } {
  const volume = ctx.trainingVolume ?? 0;
  const baseline = ctx.trainingVolumeBaseline ?? 0;
  if (volume <= 0 || baseline <= 0) return { multiplier: 1 };

  const ratio = Math.min(1.4, Math.max(0.6, volume / baseline));
  const multiplier = 1 + (ratio - 1) * 0.4;
  const deltaPct = Math.round((ratio - 1) * 100);
  if (Math.abs(deltaPct) < 8) {
    return { multiplier: 1, note: 'Training volume in line with your 4-week baseline' };
  }

  return {
    multiplier,
    note:
      deltaPct > 0
        ? `Training volume ${deltaPct}% above your 4-week baseline — energy and carbs raised ${Math.round((multiplier - 1) * 100)}%`
        : `Training volume ${Math.abs(deltaPct)}% below your 4-week baseline — energy trimmed ${Math.round((1 - multiplier) * 100)}%`,
  };
}

const LB_PER_KG = 2.20462;
const MIN_BODY_WEIGHT_KG = 35;
const MAX_BODY_WEIGHT_KG = 250;
/** Hard ceiling so a bad weight_kg (e.g. lbs×2.2 ≈ 400) cannot prescribe 10k+ kcal days. */
const MAX_DAILY_CALORIES = 4500;
const MIN_DAILY_CALORIES = 1200;

/**
 * Body mass for macro math. Catches the classic lbs↔kg inversion where ~180 lb
 * is stored as ~400 kg (multiply by 2.2 instead of divide), which produced dinners
 * like 3392 kcal / 266P on a single "lean beef with roasted vegetables" slot.
 *
 * stored ≈ lbs × 2.2  →  true kg = lbs / 2.2 = stored / 2.2²
 */
export function normalizeBodyWeightKg(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 75;

  // ~140–250 lb multiplied by 2.2 instead of divided → ~300–550 "kg".
  if (raw >= 300 && raw <= 550) {
    const trueKg = raw / (LB_PER_KG * LB_PER_KG);
    if (trueKg >= MIN_BODY_WEIGHT_KG && trueKg <= MAX_BODY_WEIGHT_KG) {
      return Math.round(trueKg * 10) / 10;
    }
  }

  if (raw > MAX_BODY_WEIGHT_KG) {
    const asSingleConversion = raw / LB_PER_KG;
    if (asSingleConversion >= MIN_BODY_WEIGHT_KG && asSingleConversion <= MAX_BODY_WEIGHT_KG) {
      return Math.round(asSingleConversion * 10) / 10;
    }
    return MAX_BODY_WEIGHT_KG;
  }

  if (raw < MIN_BODY_WEIGHT_KG) return MIN_BODY_WEIGHT_KG;
  return raw;
}

/** True when stored weight_kg is a classic lbs↔kg inversion that normalize would rewrite. */
export function isInvertedBodyWeightKg(raw: number | null | undefined): boolean {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return false;
  return Math.abs(normalizeBodyWeightKg(raw) - raw) > 1;
}

function clampDailyCalories(calories: number): number {
  return Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, Math.round(calories)));
}

export function calculateMacroTargets(ctx: NutritionContext): MacroTargets {
  const bw = normalizeBodyWeightKg(ctx.bodyWeightKg);
  const bwLbs = bw * LB_PER_KG;
  const ageMods = ageNutritionAdjustments(ctx.ageYears);
  const weightCorrected =
    ctx.bodyWeightKg != null &&
    Number.isFinite(ctx.bodyWeightKg) &&
    Math.abs(ctx.bodyWeightKg - bw) > 1;

  const maintenanceCalories = Math.round(bwLbs * 15);
  let calories = maintenanceCalories;
  let proteinG = Math.round(bw * 2);
  let carbRatio = 0.4;
  const notes: string[] = [];
  if (weightCorrected) {
    notes.push('Body weight looked like a unit conversion error — macros use a corrected kg value');
  }

  switch (ctx.goal) {
    case 'fat_loss':
      calories = Math.round(calories * 0.85);
      proteinG = Math.round(bw * 2.2);
      notes.push('Moderate deficit for fat loss');
      break;
    case 'muscle_gain':
      calories = Math.round(calories * 1.1);
      proteinG = Math.round(bw * 2.2);
      carbRatio = 0.45;
      notes.push('Calorie surplus for muscle gain');
      break;
    case 'strength':
      proteinG = Math.round(bw * 2);
      carbRatio = 0.42;
      notes.push('Strength-focused macro split');
      break;
    default:
      notes.push('Balanced maintenance targets');
  }

  const volumeAdjustment = trainingVolumeAdjustment(ctx);
  if (volumeAdjustment.multiplier !== 1) {
    calories = Math.round(calories * volumeAdjustment.multiplier);
  }
  if (volumeAdjustment.note) notes.push(volumeAdjustment.note);

  // Derived after the goal and volume adjustments so the split describes the calorie target
  // actually being prescribed rather than the pre-adjustment maintenance figure.
  let carbsG = Math.round((calories * carbRatio) / 4);
  let fatG = Math.round((calories * 0.25) / 9);

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

  let finalCalories = clampDailyCalories(reconciled.calories);
  let finalProtein = reconciled.proteinG;
  let finalCarbs = reconciled.carbsG;
  let finalFat = reconciled.fatG;

  if (finalCalories !== reconciled.calories && reconciled.calories > 0) {
    const scale = finalCalories / reconciled.calories;
    finalProtein = Math.round(reconciled.proteinG * scale);
    finalCarbs = Math.round(reconciled.carbsG * scale);
    finalFat = Math.round(reconciled.fatG * scale);
    notes.push(`Daily calories capped at ${MAX_DAILY_CALORIES}`);
  }

  return {
    calories: finalCalories,
    proteinG: finalProtein,
    carbsG: finalCarbs,
    fatG: finalFat,
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

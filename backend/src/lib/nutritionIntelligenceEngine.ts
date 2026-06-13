import { addDays, dayLabel } from './programTypes.js';
import {
  calculateMacroTargets,
  generateDailyMeals,
  inferWorkoutType,
  type MacroTargets,
  type NutritionContext,
} from './workoutAwareNutrition.js';

export type NutritionGoalFocus = 'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness';
export type WeightTrend = 'losing' | 'gaining' | 'stable' | 'unknown';
export type NutritionCoachingAction =
  | 'increase_carbs'
  | 'reduce_calories'
  | 'increase_protein'
  | 'hydration_reminder';

export type NutritionEngineInput = {
  userId: string;
  today: string;
  goal: NutritionGoalFocus;
  bodyWeightKg?: number;
  recoveryScore: number;
  recoveryStatus: string;
  recoveryModeActive: boolean;
  trainingVolume7d: number;
  upcomingWorkout?: {
    date: string;
    name: string;
    muscleGroups: string[];
    isTrainingDay: boolean;
    sessionKind?: 'strength' | 'cardio' | 'mobility';
  };
  /** When set, today's meal suggestions reflect the user's stored meal plan (post-adaptation). */
  todayPlanMeals?: MealSuggestion[];
  weightTrend: WeightTrend;
  weightDeltaKg?: number;
  adherencePct: number;
  nutritionLogDays7d: number;
  intakeToday: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterMl: number;
  };
  dietaryStyle?: NutritionContext['dietaryStyle'];
  trainingDaysThisWeek?: string[];
};

export type DailyCoachingTip = {
  action: NutritionCoachingAction;
  title: string;
  message: string;
  priority: number;
};

export type MealSuggestion = {
  mealType: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rationale?: string;
};

export type GroceryItemSuggestion = {
  name: string;
  quantity?: string;
  category: string;
};

export type WeeklyNutritionDay = {
  date: string;
  dayLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isTrainingDay: boolean;
  focus?: string;
};

export type NutritionIntelligenceReport = {
  assessedAt: string;
  context: {
    userId: string;
    goal: NutritionGoalFocus;
    goalLabel: string;
    recoveryScore: number;
    recoveryStatus: string;
    trainingVolume7d: number;
    upcomingWorkout?: {
      date: string;
      name: string;
      muscleGroups: string[];
      isTrainingDay: boolean;
      workoutType: string;
    };
    weightTrend: WeightTrend;
    weightDeltaKg?: number;
    currentWeightKg?: number;
    adherencePct: number;
    nutritionLogDays7d: number;
    caloriesConsumedToday: number;
    proteinConsumedToday: number;
    carbsConsumedToday: number;
    fatConsumedToday: number;
    waterMlToday: number;
  };
  macroTargets: MacroTargets & { hydrationMl: number };
  intakeToday: NutritionEngineInput['intakeToday'];
  gapAnalysis: {
    caloriesRemaining: number;
    proteinRemainingG: number;
    carbsRemainingG: number;
    fatRemainingG: number;
    hydrationRemainingMl: number;
  };
  coachingTips: DailyCoachingTip[];
  mealSuggestions: MealSuggestion[];
  groceryList: GroceryItemSuggestion[];
  weeklyPlan: WeeklyNutritionDay[];
  rationale: string;
  voiceEatTodayLine: string;
  voiceGroceryLine: string;
};

const GOAL_LABELS: Record<NutritionGoalFocus, string> = {
  fat_loss: 'Fat Loss',
  muscle_gain: 'Muscle Gain',
  strength: 'Strength',
  general_fitness: 'General Fitness',
};

const GROCERY_MAP: Record<string, { name: string; category: string; quantity?: string }> = {
  yogurt: { name: 'Greek yogurt', category: 'Dairy', quantity: '1 tub' },
  berries: { name: 'Mixed berries', category: 'Produce', quantity: '1 pack' },
  whey: { name: 'Whey protein', category: 'Supplements', quantity: '1 bag' },
  chicken: { name: 'Chicken breast', category: 'Protein', quantity: '1 kg' },
  quinoa: { name: 'Quinoa', category: 'Grains', quantity: '1 bag' },
  salmon: { name: 'Salmon fillets', category: 'Protein', quantity: '4 fillets' },
  vegetables: { name: 'Mixed vegetables', category: 'Produce', quantity: '1 bag' },
  almonds: { name: 'Almonds', category: 'Pantry', quantity: '1 bag' },
  eggs: { name: 'Eggs', category: 'Protein', quantity: '1 dozen' },
  avocado: { name: 'Avocados', category: 'Produce', quantity: '3' },
  spinach: { name: 'Spinach', category: 'Produce', quantity: '1 bag' },
  turkey: { name: 'Turkey breast', category: 'Protein', quantity: '500 g' },
  steak: { name: 'Lean steak', category: 'Protein', quantity: '500 g' },
  asparagus: { name: 'Asparagus', category: 'Produce', quantity: '1 bunch' },
  oats: { name: 'Rolled oats', category: 'Grains', quantity: '1 bag' },
  banana: { name: 'Bananas', category: 'Produce', quantity: '5' },
  rice: { name: 'Brown rice', category: 'Grains', quantity: '1 bag' },
  beef: { name: 'Lean ground beef', category: 'Protein', quantity: '500 g' },
  apple: { name: 'Apples', category: 'Produce', quantity: '4' },
};

export function inferWeightTrend(
  samples: Array<{ weightKg: number; recordedAt: string }>,
): { trend: WeightTrend; deltaKg?: number; currentKg?: number } {
  if (samples.length === 0) return { trend: 'unknown' };
  const sorted = [...samples].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = sorted[sorted.length - 1]!;
  const earliest = sorted[0]!;
  const delta = Math.round((latest.weightKg - earliest.weightKg) * 100) / 100;
  if (Math.abs(delta) < 0.3) return { trend: 'stable', deltaKg: delta, currentKg: latest.weightKg };
  return { trend: delta < 0 ? 'losing' : 'gaining', deltaKg: delta, currentKg: latest.weightKg };
}

export function computeHydrationMl(bodyWeightKg: number | undefined, workoutType: NutritionContext['workoutType']): number {
  const bw = bodyWeightKg ?? 75;
  let ml = Math.round(bw * 35);
  if (workoutType === 'leg' || workoutType === 'full') ml = Math.round(ml * 1.15);
  if (workoutType === 'cardio') ml = Math.round(ml * 1.2);
  return Math.max(2000, ml);
}

export function computeNutritionAdherence(logDays7d: number, targetDays = 7): number {
  return Math.min(100, Math.round((logDays7d / targetDays) * 100));
}

function adjustMacrosForTrend(
  macros: MacroTargets,
  trend: WeightTrend,
  goal: NutritionGoalFocus,
): MacroTargets {
  const notes = [macros.rationale];
  let { calories, proteinG, carbsG, fatG } = macros;

  if (goal === 'fat_loss' && trend === 'gaining') {
    calories = Math.round(calories * 0.92);
    notes.push('Weight trending up — slight calorie reduction');
  } else if (goal === 'muscle_gain' && trend === 'losing') {
    calories = Math.round(calories * 1.08);
    carbsG = Math.round(carbsG * 1.1);
    notes.push('Weight trending down — increase calories for muscle gain');
  } else if (goal === 'fat_loss' && trend === 'losing') {
    notes.push('Weight trend supports fat loss goal');
  }

  if (trend === 'stable' && goal === 'general_fitness') {
    notes.push('Weight stable — maintenance targets');
  }

  return { calories, proteinG, carbsG, fatG, rationale: notes.join('. ') + '.' };
}

function buildCoachingTips(
  input: NutritionEngineInput,
  macros: MacroTargets & { hydrationMl: number },
  gaps: NutritionIntelligenceReport['gapAnalysis'],
): DailyCoachingTip[] {
  const tips: DailyCoachingTip[] = [];
  const { upcomingWorkout, recoveryScore, intakeToday, adherencePct } = input;

  if (upcomingWorkout?.isTrainingDay && gaps.carbsRemainingG > 40) {
    tips.push({
      action: 'increase_carbs',
      title: 'Increase carbs',
      message: `Training ${upcomingWorkout.name} today — aim for ${Math.min(gaps.carbsRemainingG, 80)}g more carbs for fuel.`,
      priority: 1,
    });
  } else if (upcomingWorkout?.isTrainingDay && intakeToday.carbsG < macros.carbsG * 0.4) {
    tips.push({
      action: 'increase_carbs',
      title: 'Increase carbs',
      message: 'Pre-workout carbs are low — add rice, oats, or fruit before your session.',
      priority: 2,
    });
  }

  if (input.goal === 'fat_loss' && gaps.caloriesRemaining < -150) {
    tips.push({
      action: 'reduce_calories',
      title: 'Reduce calories',
      message: `You're ${Math.abs(gaps.caloriesRemaining)} kcal over target — lighter dinner or skip the snack.`,
      priority: 1,
    });
  } else if (input.goal === 'fat_loss' && intakeToday.calories > macros.calories * 1.1) {
    tips.push({
      action: 'reduce_calories',
      title: 'Reduce calories',
      message: 'Calories above fat-loss target — focus on lean protein and vegetables for remaining meals.',
      priority: 2,
    });
  }

  if (gaps.proteinRemainingG > 25 || (recoveryScore < 50 && gaps.proteinRemainingG > 10)) {
    tips.push({
      action: 'increase_protein',
      title: 'Increase protein',
      message:
        recoveryScore < 50
          ? `Recovery is ${recoveryScore} — prioritize ${gaps.proteinRemainingG}g more protein for repair.`
          : `${gaps.proteinRemainingG}g protein remaining to hit today's target.`,
      priority: recoveryScore < 50 ? 1 : 3,
    });
  }

  if (gaps.hydrationRemainingMl > 500 || intakeToday.waterMl < macros.hydrationMl * 0.5) {
    tips.push({
      action: 'hydration_reminder',
      title: 'Hydration reminder',
      message: `${Math.max(gaps.hydrationRemainingMl, 250)} ml water still needed today.`,
      priority: intakeToday.waterMl < macros.hydrationMl * 0.3 ? 1 : 4,
    });
  }

  if (adherencePct < 50) {
    tips.push({
      action: 'increase_protein',
      title: 'Log your meals',
      message: `Only ${input.nutritionLogDays7d}/7 days logged — consistent tracking improves recommendations.`,
      priority: 5,
    });
  }

  return tips.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function mealNameToGroceryItems(mealName: string): GroceryItemSuggestion[] {
  const lower = mealName.toLowerCase();
  const items: GroceryItemSuggestion[] = [];
  for (const [key, item] of Object.entries(GROCERY_MAP)) {
    if (lower.includes(key)) items.push({ ...item });
  }
  if (items.length === 0) {
    items.push({ name: mealName.split(' with ')[0] ?? mealName, category: 'Groceries' });
  }
  return items;
}

function buildGroceryList(meals: MealSuggestion[], weeklyPlan: WeeklyNutritionDay[]): GroceryItemSuggestion[] {
  const seen = new Set<string>();
  const items: GroceryItemSuggestion[] = [];

  for (const meal of meals) {
    for (const item of mealNameToGroceryItems(meal.name)) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  if (weeklyPlan.some((d) => d.isTrainingDay)) {
    for (const extra of ['Bananas', 'Brown rice', 'Chicken breast']) {
      const key = extra.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ name: extra, category: extra.includes('Chicken') ? 'Protein' : 'Pantry' });
      }
    }
  }

  return items.slice(0, 20);
}

function buildWeeklyPlan(
  input: NutritionEngineInput,
  baseMacros: MacroTargets,
  style: NutritionContext['dietaryStyle'],
): WeeklyNutritionDay[] {
  const trainingDays = new Set(input.trainingDaysThisWeek ?? []);
  if (input.upcomingWorkout?.isTrainingDay) trainingDays.add(input.today);

  const days: WeeklyNutritionDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(input.today, i);
    const isTrainingDay = trainingDays.has(date) || (i === 0 && !!input.upcomingWorkout?.isTrainingDay);
    const workoutType = isTrainingDay
      ? inferWorkoutType(input.upcomingWorkout?.muscleGroups ?? ['full'])
      : 'rest';
    const dayMacros = calculateMacroTargets({
      goal: input.goal,
      bodyWeightKg: input.bodyWeightKg,
      recoveryScore: input.recoveryScore,
      recoveryModeActive: input.recoveryModeActive,
      workoutType,
      isTrainingDay,
      dietaryStyle: style,
    });
    const dateObj = new Date(date + 'T12:00:00');
    const dow = dateObj.getDay();
    const dowIndex = dow === 0 ? 6 : dow - 1;
    days.push({
      date,
      dayLabel: dayLabel(dowIndex),
      calories: dayMacros.calories,
      proteinG: dayMacros.proteinG,
      carbsG: dayMacros.carbsG,
      fatG: dayMacros.fatG,
      isTrainingDay,
      focus: isTrainingDay ? 'Higher carbs for training' : 'Recovery & lower carbs',
    });
  }
  return days;
}

function buildVoiceLines(
  macros: MacroTargets & { hydrationMl: number },
  meals: MealSuggestion[],
  tips: DailyCoachingTip[],
  grocery: GroceryItemSuggestion[],
): { eatToday: string; grocery: string } {
  const mealSummary = meals.slice(0, 3).map((m) => `${m.mealType}: ${m.name}`).join('. ');
  const tipSummary = tips[0]?.message ?? `Target ${macros.calories} calories and ${macros.proteinG} grams protein.`;
  const eatToday = `Today aim for ${macros.calories} calories, ${macros.proteinG}g protein, and ${Math.round(macros.hydrationMl / 250)} glasses of water. ${tipSummary} Meals: ${mealSummary}.`;
  const groceryLine =
    grocery.length > 0
      ? `Your shopping list has ${grocery.length} items: ${grocery.slice(0, 5).map((g) => g.name).join(', ')}${grocery.length > 5 ? ', and more' : ''}.`
      : 'Add meals to your plan to generate a shopping list.';
  return { eatToday, grocery: groceryLine };
}

export function computeNutritionIntelligence(input: NutritionEngineInput): NutritionIntelligenceReport {
  const muscleGroups = input.upcomingWorkout?.muscleGroups ?? [];
  const sessionKind = input.upcomingWorkout?.sessionKind;
  const workoutType =
    sessionKind === 'cardio'
      ? 'cardio'
      : sessionKind === 'mobility'
        ? 'rest'
        : muscleGroups.length
          ? inferWorkoutType(muscleGroups)
          : 'rest';
  const isTrainingDay = input.upcomingWorkout?.isTrainingDay ?? false;

  let baseMacros = calculateMacroTargets({
    goal: input.goal,
    bodyWeightKg: input.bodyWeightKg,
    recoveryScore: input.recoveryScore,
    recoveryModeActive: input.recoveryModeActive,
    trainingVolume: input.trainingVolume7d,
    workoutType,
    sessionKind,
    isTrainingDay,
    dietaryStyle: input.dietaryStyle ?? 'balanced',
  });

  baseMacros = adjustMacrosForTrend(baseMacros, input.weightTrend, input.goal);

  const hydrationMl = computeHydrationMl(input.bodyWeightKg, workoutType);
  const macroTargets = { ...baseMacros, hydrationMl };

  const gaps = {
    caloriesRemaining: macroTargets.calories - input.intakeToday.calories,
    proteinRemainingG: macroTargets.proteinG - input.intakeToday.proteinG,
    carbsRemainingG: macroTargets.carbsG - input.intakeToday.carbsG,
    fatRemainingG: macroTargets.fatG - input.intakeToday.fatG,
    hydrationRemainingMl: hydrationMl - input.intakeToday.waterMl,
  };

  const coachingTips = buildCoachingTips(input, macroTargets, gaps);
  const mealRows = generateDailyMeals(input.today, baseMacros, input.dietaryStyle ?? 'balanced');
  const mealSuggestions: MealSuggestion[] =
    input.todayPlanMeals && input.todayPlanMeals.length > 0
      ? input.todayPlanMeals.map((m) => ({
          ...m,
          rationale: m.rationale ?? 'From your adapted meal plan',
        }))
      : mealRows.map((m) => ({
          mealType: m.mealType,
          name: m.name,
          calories: m.calories,
          proteinG: m.proteinG,
          carbsG: m.carbsG,
          fatG: m.fatG,
          rationale: isTrainingDay && m.mealType === 'lunch' ? 'Fuel before training' : undefined,
        }));

  const weeklyPlan = buildWeeklyPlan(input, baseMacros, input.dietaryStyle ?? 'balanced');
  const groceryList = buildGroceryList(mealSuggestions, weeklyPlan);
  const voice = buildVoiceLines(macroTargets, mealSuggestions, coachingTips, groceryList);

  const rationaleParts = [
    baseMacros.rationale,
    `Recovery ${input.recoveryScore} (${input.recoveryStatus.replace(/_/g, ' ')}).`,
    input.upcomingWorkout?.isTrainingDay
      ? `Training day: ${input.upcomingWorkout.name}.`
      : 'Rest day nutrition.',
    input.weightTrend !== 'unknown'
      ? `Weight trend: ${input.weightTrend}${input.weightDeltaKg != null ? ` (${input.weightDeltaKg > 0 ? '+' : ''}${input.weightDeltaKg} kg)` : ''}.`
      : '',
    `Logging adherence ${input.adherencePct}%.`,
  ].filter(Boolean);

  return {
    assessedAt: new Date().toISOString(),
    context: {
      userId: input.userId,
      goal: input.goal,
      goalLabel: GOAL_LABELS[input.goal],
      recoveryScore: input.recoveryScore,
      recoveryStatus: input.recoveryStatus,
      trainingVolume7d: input.trainingVolume7d,
      upcomingWorkout: input.upcomingWorkout
        ? { ...input.upcomingWorkout, workoutType: workoutType ?? 'rest' }
        : undefined,
      weightTrend: input.weightTrend,
      weightDeltaKg: input.weightDeltaKg,
      currentWeightKg: input.bodyWeightKg,
      adherencePct: input.adherencePct,
      nutritionLogDays7d: input.nutritionLogDays7d,
      caloriesConsumedToday: input.intakeToday.calories,
      proteinConsumedToday: input.intakeToday.proteinG,
      carbsConsumedToday: input.intakeToday.carbsG,
      fatConsumedToday: input.intakeToday.fatG,
      waterMlToday: input.intakeToday.waterMl,
    },
    macroTargets,
    intakeToday: input.intakeToday,
    gapAnalysis: gaps,
    coachingTips,
    mealSuggestions,
    groceryList,
    weeklyPlan,
    rationale: rationaleParts.join(' '),
    voiceEatTodayLine: voice.eatToday,
    voiceGroceryLine: voice.grocery,
  };
}

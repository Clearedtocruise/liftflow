import type { BaseEntity, MealType, ResearchCitation } from './common';

export type NutritionGoals = BaseEntity & {
  userId: string;
  dailyCalories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  isActive: boolean;
  effectiveFrom: string;
};

export type MealPlan = BaseEntity & {
  userId: string;
  name: string;
  weekStartDate: string;
  aiGenerated: boolean;
  aiRationale?: string;
  meals: Meal[];
};

export type MealStatus = 'planned' | 'completed' | 'skipped' | 'modified';

/** `plan` = generated slot, `log` = something the user actually ate. */
export type MealOrigin = 'plan' | 'log';

export type Meal = BaseEntity & {
  mealPlanId?: string;
  userId: string;
  mealType: MealType;
  name: string;
  scheduledDate?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  instructions?: string;
  status: MealStatus;
  origin: MealOrigin;
  consumedAt?: string;
  clientKey?: string;
  /** True when the macros on this row came from a measurement rather than a guess. */
  macrosProvided: boolean;
};

export type GroceryList = BaseEntity & {
  userId: string;
  mealPlanId?: string;
  name: string;
  weekStartDate?: string;
  items: GroceryListItem[];
};

export type GroceryListItem = {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  isChecked: boolean;
  sortOrder: number;
};

export type HydrationLog = BaseEntity & {
  userId: string;
  loggedAt: string;
  amountMl: number;
  source: string;
};

export type NutritionRecommendation = BaseEntity & {
  userId: string;
  title: string;
  description: string;
  rationale?: string;
  evidenceCitations: ResearchCitation[];
  payload: Record<string, unknown>;
};

export type DailyNutritionSummary = {
  date: string;
  caloriesConsumed: number;
  caloriesTarget?: number;
  proteinG: number;
  /** From the active nutrition goal; absent when the user has not set one. */
  proteinTargetG?: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  waterTargetMl?: number;
};

export type MealReplacementScope = 'meal' | 'day' | 'week';

export type FoodMacroEstimate = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reasoning?: string;
};

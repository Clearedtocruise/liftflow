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
  carbsG: number;
  fatG: number;
  waterMl: number;
  waterTargetMl?: number;
};

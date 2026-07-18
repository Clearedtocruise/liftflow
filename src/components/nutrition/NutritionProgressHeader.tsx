import { NutritionMetricsRow } from '@/components/nutrition/NutritionMetricsRow';
import type { DailyNutritionSummary, NutritionGoals } from '@/types';

type NutritionProgressHeaderProps = {
  summary: DailyNutritionSummary | null;
  goals: NutritionGoals | null;
  mealsCompleted: number;
  mealsTotal: number;
  caloriesConsumed: number;
  proteinG: number;
};

export function NutritionProgressHeader({
  summary,
  goals,
  mealsCompleted,
  mealsTotal,
  caloriesConsumed,
  proteinG,
}: NutritionProgressHeaderProps) {
  const calorieGoal = goals?.dailyCalories ?? summary?.caloriesTarget ?? 0;
  const proteinGoal = goals?.proteinG ?? 0;
  const caloriesLeft = Math.max(0, Math.round(calorieGoal - caloriesConsumed));
  const proteinLeft = Math.max(0, Math.round(proteinGoal - proteinG));

  return (
    <NutritionMetricsRow
      layout="rows"
      caloriesLabel="Calories left"
      caloriesValue={calorieGoal > 0 ? String(caloriesLeft) : String(Math.round(caloriesConsumed))}
      caloriesFooter={calorieGoal ? `of ${Math.round(calorieGoal)}` : undefined}
      proteinLabel="Protein left"
      proteinValue={proteinGoal > 0 ? `${proteinLeft}g` : `${Math.round(proteinG)}g`}
      proteinFooter={proteinGoal ? `of ${Math.round(proteinGoal)}g` : undefined}
      mealsLabel="Meals"
      mealsValue={`${mealsCompleted}/${mealsTotal || '—'}`}
      mealsFooter="logged today"
    />
  );
}

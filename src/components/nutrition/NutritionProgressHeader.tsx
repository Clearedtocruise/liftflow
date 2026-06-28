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

  return (
    <NutritionMetricsRow
      layout="rows"
      caloriesLabel="Calories"
      caloriesValue={String(caloriesConsumed)}
      caloriesFooter={calorieGoal ? `of ${calorieGoal} goal` : undefined}
      proteinLabel="Protein"
      proteinValue={`${Math.round(proteinG)}g`}
      proteinFooter={proteinGoal ? `of ${proteinGoal}g goal` : undefined}
      mealsLabel="Meals"
      mealsValue={`${mealsCompleted}/${mealsTotal || '—'}`}
      mealsFooter="logged today"
    />
  );
}

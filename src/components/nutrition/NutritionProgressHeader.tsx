import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
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
    <Card style={styles.card}>
      <AppText variant="body" color="textSecondary">
        {caloriesConsumed} / {calorieGoal || '—'} cal · {Math.round(proteinG)} / {proteinGoal || '—'}g protein ·{' '}
        {mealsCompleted} / {mealsTotal} meals
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
});

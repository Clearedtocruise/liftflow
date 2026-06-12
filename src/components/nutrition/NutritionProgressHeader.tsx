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
};

export function NutritionProgressHeader({ summary, goals, mealsCompleted, mealsTotal }: NutritionProgressHeaderProps) {
  const caloriesRemaining = Math.max(0, (goals?.dailyCalories ?? 0) - (summary?.caloriesConsumed ?? 0));
  const proteinRemaining = Math.max(0, (goals?.proteinG ?? 0) - (summary?.proteinG ?? 0));

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Nutrition Dashboard
      </AppText>
      <View style={styles.row}>
        <Metric label="Meals" value={`${mealsCompleted}/${mealsTotal}`} />
        <Metric label="Calories left" value={`${caloriesRemaining}`} />
        <Metric label="Protein left" value={`${Math.round(proteinRemaining)}g`} />
      </View>
      <AppText variant="caption" color="textSecondary">
        Consumed {summary?.caloriesConsumed ?? 0} cal · {Math.round(summary?.proteinG ?? 0)}g protein
      </AppText>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metric: {
    flex: 1,
    gap: Spacing.xs,
  },
});

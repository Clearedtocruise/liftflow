import { StyleSheet, View } from 'react-native';

import { StatCard } from '@/components/layout/StatCard';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type NutritionMetricsRowProps = {
  caloriesLabel?: string;
  caloriesValue: string;
  caloriesFooter?: string;
  proteinLabel?: string;
  proteinValue?: string;
  proteinFooter?: string;
  mealsLabel?: string;
  mealsValue?: string;
  mealsFooter?: string;
};

/** Three-up macro summary — matches Home and History stat rows. */
export function NutritionMetricsRow({
  caloriesLabel = 'Calories',
  caloriesValue,
  caloriesFooter,
  proteinLabel = 'Protein',
  proteinValue,
  proteinFooter,
  mealsLabel = 'Meals',
  mealsValue,
  mealsFooter,
}: NutritionMetricsRowProps) {
  return (
    <View style={styles.row}>
      <StatCard label={caloriesLabel} footer={caloriesFooter}>
        <AppText variant="metric" color="accent" style={styles.metric}>
          {caloriesValue}
        </AppText>
      </StatCard>
      {proteinValue != null ? (
        <StatCard label={proteinLabel} footer={proteinFooter}>
          <AppText variant="metric" style={styles.metric}>
            {proteinValue}
          </AppText>
        </StatCard>
      ) : null}
      {mealsValue != null ? (
        <StatCard label={mealsLabel} footer={mealsFooter}>
          <AppText variant="metric" style={styles.metric}>
            {mealsValue}
          </AppText>
        </StatCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metric: {
    fontSize: 28,
    lineHeight: 32,
  },
});

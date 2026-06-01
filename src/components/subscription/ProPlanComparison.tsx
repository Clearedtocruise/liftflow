import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FREE_FEATURES, PRO_FEATURES, SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';

type ProPlanComparisonProps = {
  price: string;
  showTrial?: boolean;
};

export function ProPlanComparison({ price, showTrial = true }: ProPlanComparisonProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <AppText variant="label" color="textSecondary">
          Free
        </AppText>
        {FREE_FEATURES.map((item) => (
          <AppText key={item} variant="footnote" color="textSecondary">
            • {item}
          </AppText>
        ))}
      </View>
      <View style={styles.column}>
        <AppText variant="label" color="accent">
          {SUBSCRIPTION.planName} — {price}/mo
        </AppText>
        {showTrial && SUBSCRIPTION.trialDays > 0 ? (
          <AppText variant="caption" color="accent">
            {SUBSCRIPTION.trialLabel}
          </AppText>
        ) : null}
        {PRO_FEATURES.map((item) => (
          <AppText key={item} variant="footnote">
            • {item}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  column: {
    flex: 1,
    gap: Spacing.xs,
  },
});

import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type CoachInsightsPanelProps = {
  insights: string[];
};

export function CoachInsightsPanel({ insights }: CoachInsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Coach insights
      </AppText>
      {insights.map((line) => (
        <View key={line} style={styles.row}>
          <AppText variant="caption" color="accent">
            •
          </AppText>
          <AppText variant="footnote" color="textSecondary" style={styles.text}>
            {line}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  text: { flex: 1 },
});

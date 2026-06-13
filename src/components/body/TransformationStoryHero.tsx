import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Radius, Spacing } from '@/constants/theme';
import { formatDisplayDate } from '@/lib/transformation/transformationStory';
import type { TransformationStory } from '@/types/transformation';

type TransformationStoryHeroProps = {
  story: TransformationStory;
  formatWeight: (kg: number) => string;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="headline">{value}</AppText>
    </View>
  );
}

export function TransformationStoryHero({ story, formatWeight }: TransformationStoryHeroProps) {
  return (
    <Card style={styles.card} glow>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.12)', 'rgba(0, 229, 255, 0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <AppText variant="label" color="accent">
          Your transformation
        </AppText>
        <AppText variant="metric" color="accent">
          {story.progressPercent}%
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          toward {story.goalBodyFatPct}% body fat
        </AppText>

        <View style={styles.row}>
          <Metric label="Current weight" value={formatWeight(story.currentWeightKg)} />
          <Metric label="Current BF" value={`${story.currentBodyFatPct}%`} />
        </View>
        <View style={styles.row}>
          <Metric label="Goal weight" value={formatWeight(story.goalWeightKg)} />
          <Metric label="Goal BF" value={`${story.goalBodyFatPct}%`} />
        </View>

        <View style={styles.footer}>
          {story.daysRemaining != null ? (
            <AppText variant="bodyBold">
              {story.daysRemaining} days remaining
            </AppText>
          ) : null}
          {story.estimatedCompletionDate ? (
            <AppText variant="footnote" color="textSecondary">
              Est. completion {formatDisplayDate(story.estimatedCompletionDate)}
            </AppText>
          ) : null}
        </View>
      </LinearGradient>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  gradient: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  metric: { flex: 1, gap: Spacing.xs },
  footer: { marginTop: Spacing.md, gap: Spacing.xs },
});

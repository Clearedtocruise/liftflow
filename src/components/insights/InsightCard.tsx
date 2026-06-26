import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { AppText } from '@/components/ui/AppText';
import type { LiftFlowInsight } from '@/constants/insights/types';
import { INSIGHT_CATEGORY_LABELS } from '@/constants/insights/types';
import { BrandGradients, LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

type InsightCardProps = {
  insight: LiftFlowInsight;
  compact?: boolean;
};

export function InsightCard({ insight, compact }: InsightCardProps) {
  return (
    <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.wrap}>
      <GradientBorderCard intensity="subtle" innerStyle={[styles.inner, compact && styles.innerCompact]}>
        <LinearGradient colors={[...BrandGradients.insightFill]} style={StyleSheet.absoluteFill} />
        <AppText variant="label" color="accent">
          {INSIGHT_CATEGORY_LABELS[insight.category]}
        </AppText>
        <View style={styles.titleRow}>
          <View style={styles.iconBubble}>
            <AppText variant="headline" style={styles.icon}>
              {insight.icon}
            </AppText>
          </View>
          <AppText variant="subhead" style={styles.headline}>
            {insight.headline}
          </AppText>
        </View>
        <AppText variant="footnote" color="textSecondary">
          {insight.body}
        </AppText>
      </GradientBorderCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...Shadows.card,
  },
  inner: {
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  innerCompact: {
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  headline: {
    flex: 1,
  },
});

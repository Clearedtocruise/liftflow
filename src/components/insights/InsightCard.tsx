import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import type { LiftFlowInsight } from '@/constants/insights/types';
import { INSIGHT_CATEGORY_LABELS } from '@/constants/insights/types';
import { LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

type InsightCardProps = {
  insight: LiftFlowInsight;
  compact?: boolean;
};

export function InsightCard({ insight, compact }: InsightCardProps) {
  return (
    <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.wrap}>
      <LinearGradient
        colors={['rgba(31, 107, 255, 0.45)', 'rgba(0, 229, 255, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}>
        <View style={[styles.inner, compact && styles.innerCompact]}>
          <LinearGradient
            colors={['rgba(31, 107, 255, 0.12)', 'rgba(8, 11, 16, 0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <AppText variant="label" color="accent" style={styles.pill}>
            LiftFlow Insight · {INSIGHT_CATEGORY_LABELS[insight.category]}
          </AppText>
          <View style={styles.titleRow}>
            <View style={styles.iconBubble}>
              <AppText variant="headline" style={styles.icon}>
                {insight.icon}
              </AppText>
            </View>
            <AppText variant="headline" style={styles.headline}>
              {insight.headline}
            </AppText>
          </View>
          <AppText variant="footnote" color="textSecondary">
            {insight.body}
          </AppText>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
  },
  border: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  inner: {
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  innerCompact: {
    padding: Spacing.md,
  },
  pill: {
    fontSize: 10,
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

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { AppText } from '@/components/ui/AppText';
import type { LiftFlowInsight } from '@/constants/insights/types';
import { INSIGHT_CATEGORY_LABELS } from '@/constants/insights/types';
import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type InsightCardProps = {
  insight: LiftFlowInsight;
  compact?: boolean;
};

export function InsightCard({ insight, compact }: InsightCardProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.wrap}>
      <GradientBorderCard intensity="subtle" innerStyle={[styles.inner, compact && styles.innerCompact]}>
        <LinearGradient colors={[...theme.brandGradients.insightFill]} style={StyleSheet.absoluteFill} />
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      ...theme.shadows.card,
    },
    inner: {
      overflow: 'hidden',
      gap: theme.spacing.sm,
    },
    innerCompact: {
      padding: theme.spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primaryGlow,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    icon: {
      fontSize: 20,
      lineHeight: 24,
    },
    headline: {
      flex: 1,
    },
  });
}

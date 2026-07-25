import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { FEATURES_BY_CATEGORY, PHASE_LABELS, type FeatureCategory, type FeatureDefinition } from '@/constants/features';
import { LiftFlowColors, Spacing } from '@/constants/theme';

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  workout: 'Workout',
  training: 'Training & Planning',
  ai: 'AI Coaching',
  nutrition: 'Nutrition',
  body: 'Body & Progress',
  analytics: 'Analytics',
  integrations: 'Integrations',
  platform: 'Platform',
};

/**
 * Feature hub — navigation entry point for all planned ONE MORE capabilities.
 * MVP features link to active tabs; future features link to placeholder screens.
 */
export default function ExploreScreen() {
  const categories = Object.entries(FEATURES_BY_CATEGORY) as [FeatureCategory, FeatureDefinition[]][];

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="title">Explore</AppText>
        <AppText variant="body" color="textSecondary">
          ONE MORE platform capabilities
        </AppText>
      </View>

      {categories.map(([category, features]) => (
        <View key={category} style={styles.section}>
          <SectionHeader title={CATEGORY_LABELS[category]} />
          {features.map((feature) => (
            <FeatureLink key={feature.id} feature={feature} />
          ))}
        </View>
      ))}
    </ScreenContainer>
  );
}

function FeatureLink({ feature }: { feature: FeatureDefinition }) {
  const isMvp = feature.phase === 'mvp';

  // Navigating by id instead of route sent every feature whose id and filename differ to the
  // "planned feature" placeholder — Peak Music Sync ships today but resolved to a stub.
  function handlePress() {
    router.push(feature.route as '/(tabs)/workout');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${feature.title}. ${isMvp ? 'Available' : PHASE_LABELS[feature.phase]}`}
      accessibilityHint={feature.description}>
      <Card style={styles.featureCard}>
        <View style={styles.featureRow}>
          <AppSymbol
            name={feature.icon as SFSymbol}
            fallback="●"
            size={22}
            tintColor={isMvp ? LiftFlowColors.accent : LiftFlowColors.textSecondary}
          />
          <View style={styles.featureText}>
            <AppText variant="callout">{feature.title}</AppText>
            <AppText variant="caption" color="textTertiary">
              {isMvp ? 'Available' : PHASE_LABELS[feature.phase]}
            </AppText>
          </View>
          <AppSymbol
            name="chevron.right"
            fallback={SYMBOL_FALLBACKS['chevron.right']}
            size={14}
            tintColor={LiftFlowColors.textTertiary}
          />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs, marginBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  featureCard: { marginBottom: Spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  featureText: { flex: 1, gap: 2 },
});

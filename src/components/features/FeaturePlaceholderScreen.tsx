import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppSymbol } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import type { FeatureDefinition } from '@/constants/features';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type FeaturePlaceholderScreenProps = {
  feature: FeatureDefinition;
};

/** Reusable placeholder for features not yet implemented. */
export function FeaturePlaceholderScreen({ feature }: FeaturePlaceholderScreenProps) {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <AppSymbol
            name={feature.icon as SFSymbol}
            fallback="●"
            size={32}
            tintColor={LiftFlowColors.accent}
          />
        </View>
        <AppText variant="title">{feature.title}</AppText>
        <AppText variant="body" color="textSecondary">
          {feature.description}
        </AppText>
      </View>

      {/* Intentionally free of build-status detail: "Architecture Ready", "TypeScript types ✓"
          and similar told users about our internals rather than about the feature. */}
      <Card style={styles.statusCard}>
        <AppText variant="caption" color="accent">
          COMING SOON
        </AppText>
        <AppText variant="bodyBold" style={styles.statusTitle}>
          We&apos;re still building this
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {feature.title} isn&apos;t ready yet. It&apos;s on our roadmap, and we&apos;ll let you know
          in the app as soon as you can use it.
        </AppText>
      </Card>

      <PrimaryButton label="Go back" onPress={() => router.back()} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LiftFlowColors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statusCard: {
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  statusTitle: {
    marginTop: Spacing.xs,
  },
});

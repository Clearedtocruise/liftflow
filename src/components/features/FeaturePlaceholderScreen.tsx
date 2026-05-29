import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppSymbol } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import type { FeatureDefinition } from '@/constants/features';
import { PHASE_LABELS } from '@/constants/features';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type FeaturePlaceholderScreenProps = {
  feature: FeatureDefinition;
};

/**
 * Reusable placeholder for features not yet implemented.
 * Displays feature metadata, planned phase, and architecture status.
 */
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

      <Card style={styles.statusCard}>
        <AppText variant="caption" color="accent">
          {PHASE_LABELS[feature.phase].toUpperCase()}
        </AppText>
        <AppText variant="bodyBold" style={styles.statusTitle}>
          Architecture Ready
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          Database schema, TypeScript types, service interfaces, and API route placeholders
          are in place. Implementation is planned for {PHASE_LABELS[feature.phase]}.
        </AppText>
      </Card>

      <Card style={styles.scaffoldCard}>
        <ScaffoldRow label="Database tables" status="ready" />
        <ScaffoldRow label="TypeScript types" status="ready" />
        <ScaffoldRow label="Service interface" status="ready" />
        <ScaffoldRow label="API routes" status="ready" />
        <ScaffoldRow label="Navigation route" status="ready" />
        <ScaffoldRow label="UI implementation" status="planned" />
      </Card>

      <PrimaryButton label="Go Back" onPress={() => router.back()} variant="secondary" />
    </ScreenContainer>
  );
}

function ScaffoldRow({ label, status }: { label: string; status: 'ready' | 'planned' }) {
  return (
    <View style={styles.scaffoldRow}>
      <AppText variant="callout">{label}</AppText>
      <AppText variant="caption" color={status === 'ready' ? 'accent' : 'textTertiary'}>
        {status === 'ready' ? '✓ Ready' : '○ Planned'}
      </AppText>
    </View>
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
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statusTitle: {
    marginTop: Spacing.xs,
  },
  scaffoldCard: {
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  scaffoldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

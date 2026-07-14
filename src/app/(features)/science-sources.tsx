import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { SCIENCE_DISCLAIMER, SCIENCE_SOURCES } from '@/constants/scienceSources';
import { Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

export default function ScienceSourcesScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <ScreenContainer>
      <AppText variant="title">Science & sources</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        References behind age-aware training, joint-friendly workouts, protein targets, and heart-rate zones.
      </AppText>

      <Card style={styles.disclaimer}>
        <AppText variant="footnote" color="textSecondary">
          {SCIENCE_DISCLAIMER}
        </AppText>
      </Card>

      {SCIENCE_SOURCES.map((source) => (
        <Card key={source.id} style={styles.card}>
          <AppText variant="bodyBold">{source.title}</AppText>
          <AppText variant="caption" color="accent">
            {source.organization}
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {source.usedFor}
          </AppText>
          <Pressable
            onPress={() => {
              void Linking.openURL(source.url);
            }}
            hitSlop={8}
            accessibilityRole="link">
            <AppText variant="caption" color="accent" style={styles.link}>
              Open source
            </AppText>
          </Pressable>
        </Card>
      ))}
    </ScreenContainer>
  );
}

function createStyles(theme: import('@/constants/themes').AppTheme) {
  return StyleSheet.create({
    subtitle: {
      marginBottom: theme.spacing.lg,
    },
    disclaimer: {
      marginBottom: theme.spacing.md,
      gap: Spacing.sm,
    },
    card: {
      gap: Spacing.sm,
      marginBottom: theme.spacing.md,
    },
    link: {
      marginTop: Spacing.xs,
    },
  });
}

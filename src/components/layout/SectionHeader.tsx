import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** `secondary` for in-screen sections below the page title. */
  variant?: 'primary' | 'secondary';
};

export function SectionHeader({ title, subtitle, action, variant = 'primary' }: SectionHeaderProps) {
  const isSecondary = variant === 'secondary';

  return (
    <View style={[styles.container, isSecondary && styles.containerSecondary]}>
      <View style={styles.textBlock}>
        <AppText variant={isSecondary ? 'label' : 'headline'} color={isSecondary ? 'accent' : 'textPrimary'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  containerSecondary: {
    marginBottom: Spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
});

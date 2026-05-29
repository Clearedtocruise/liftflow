import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <AppText variant="headline">{title}</AppText>
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
  textBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
});

import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type SettingsGroupProps = {
  children: ReactNode;
};

export function SettingsGroup({ children }: SettingsGroupProps) {
  const styles = useThemedStyles(createStyles);
  const items = Children.toArray(children).filter(Boolean);

  return (
    <Card style={styles.group}>
      {items.map((child, index) => (
        <View key={index}>
          {child}
          {index < items.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </Card>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    group: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      gap: 0,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: 36,
    },
  });
}

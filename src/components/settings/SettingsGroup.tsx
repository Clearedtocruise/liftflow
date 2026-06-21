import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type SettingsGroupProps = {
  children: ReactNode;
};

export function SettingsGroup({ children }: SettingsGroupProps) {
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

const styles = StyleSheet.create({
  group: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LiftFlowColors.border,
    marginLeft: 36,
  },
});

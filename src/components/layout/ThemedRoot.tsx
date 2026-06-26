import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';

type ThemedRootProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Applies active theme background at navigation roots. */
export function ThemedRoot({ children, style }: ThemedRootProps) {
  const theme = useAppTheme();
  return <View style={[styles.flex, { backgroundColor: theme.colors.background }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

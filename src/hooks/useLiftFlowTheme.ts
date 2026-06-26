import { useMemo } from 'react';
import type { StyleSheet } from 'react-native';

import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';

export function useLiftFlowTheme() {
  return useAppTheme().colors;
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

import { useMemo } from 'react';
import type { StyleSheet } from 'react-native';

import { darkClassicTheme, type AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';

function resolveTheme(theme: AppTheme | undefined): AppTheme {
  return theme ?? darkClassicTheme;
}

export function useLiftFlowTheme() {
  return resolveTheme(useAppTheme()).colors;
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = resolveTheme(useAppTheme());
  return useMemo(() => factory(theme), [factory, theme.id]);
}

import { Stack, type StackProps } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';

type ThemedStackProps = StackProps & {
  showHeader?: boolean;
};

/** Expo stack with background + tint colors from the active theme. */
export function ThemedStack({ showHeader = false, screenOptions, ...rest }: ThemedStackProps) {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: showHeader,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
        ...screenOptions,
      }}
      {...rest}
    />
  );
}

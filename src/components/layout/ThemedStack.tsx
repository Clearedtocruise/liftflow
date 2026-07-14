import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/contexts/ThemeContext';

type StackComponent = typeof Stack;
type ThemedStackProps = ComponentProps<StackComponent> & {
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

ThemedStack.Screen = Stack.Screen;

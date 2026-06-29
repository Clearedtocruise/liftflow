import { Stack } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';

export default function NutritionLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

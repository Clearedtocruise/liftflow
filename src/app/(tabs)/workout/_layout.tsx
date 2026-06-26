import { Stack } from 'expo-router';

import { useAppTheme } from '@/contexts/ThemeContext';

export default function WorkoutLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="day" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rest-day" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="edit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="manual-log" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="summary" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
    </Stack>
  );
}

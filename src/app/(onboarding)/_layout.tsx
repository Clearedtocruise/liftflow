import { Stack } from 'expo-router';

import { LiftFlowColors } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: LiftFlowColors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="legal" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}

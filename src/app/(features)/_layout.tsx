import { Stack } from 'expo-router';

import { LiftFlowColors } from '@/constants/theme';

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: LiftFlowColors.background },
        headerTintColor: LiftFlowColors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: LiftFlowColors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="[feature]" options={{ title: 'Feature' }} />
    </Stack>
  );
}

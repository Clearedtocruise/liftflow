import { Stack } from 'expo-router';

import { LiftFlowColors } from '@/constants/theme';
import { WorkoutPlanDraftProvider } from '@/state/workout/WorkoutPlanDraftContext';

export default function WorkoutLayout() {
  return (
    <WorkoutPlanDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: LiftFlowColors.background },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="day" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="rest-day" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="manual-log" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="summary" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
      </Stack>
    </WorkoutPlanDraftProvider>
  );
}

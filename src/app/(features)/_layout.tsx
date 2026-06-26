import { Stack, router } from 'expo-router';
import { Pressable } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { LiftFlowColors } from '@/constants/theme';

export default function FeaturesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: LiftFlowColors.background },
        headerTintColor: LiftFlowColors.textPrimary,
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: LiftFlowColors.background },
        animation: 'slide_from_right',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <AppSymbol
              name="chevron.left"
              fallback={SYMBOL_FALLBACKS['chevron.left']}
              size={20}
              tintColor={LiftFlowColors.textPrimary}
            />
          </Pressable>
        ),
      }}>
      <Stack.Screen name="[feature]" options={{ title: 'ONE MORE' }} />
    </Stack>
  );
}

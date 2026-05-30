import { Stack, router } from 'expo-router';
import { Pressable } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { LiftFlowColors } from '@/constants/theme';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: LiftFlowColors.background },
        headerTintColor: LiftFlowColors.textPrimary,
        contentStyle: { backgroundColor: LiftFlowColors.background },
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <AppSymbol name="chevron.left" fallback={SYMBOL_FALLBACKS['chevron.left']} size={20} tintColor={LiftFlowColors.textPrimary} />
          </Pressable>
        ),
      }}>
      <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
      <Stack.Screen name="subscription-terms" options={{ title: 'Subscription Terms' }} />
      <Stack.Screen name="support" options={{ title: 'Support' }} />
    </Stack>
  );
}

import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { ThemedStack } from '@/components/layout/ThemedStack';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { useLiftFlowTheme } from '@/hooks/useLiftFlowTheme';

export default function LegalLayout() {
  const colors = useLiftFlowTheme();

  return (
    <ThemedStack
      showHeader
      screenOptions={{
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <AppSymbol
              name="chevron.left"
              fallback={SYMBOL_FALLBACKS['chevron.left']}
              size={20}
              tintColor={colors.textPrimary}
            />
          </Pressable>
        ),
      }}>
      <ThemedStack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <ThemedStack.Screen name="terms" options={{ title: 'Terms of Service' }} />
      <ThemedStack.Screen name="subscription-terms" options={{ title: 'Subscription Terms' }} />
      <ThemedStack.Screen name="support" options={{ title: 'Support' }} />
    </ThemedStack>
  );
}

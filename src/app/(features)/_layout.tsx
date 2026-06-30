import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { ThemedStack } from '@/components/layout/ThemedStack';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { useLiftFlowTheme } from '@/hooks/useLiftFlowTheme';

export default function FeaturesLayout() {
  const colors = useLiftFlowTheme();

  return (
    <ThemedStack
      showHeader
      screenOptions={{
        headerBackTitle: 'Back',
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
      {/* Cardio — full-screen flows use TabScreenHeader internally */}
      <ThemedStack.Screen name="cardio-tracking" options={{ headerShown: false }} />
      <ThemedStack.Screen name="log-activity" options={{ headerShown: false }} />
      <ThemedStack.Screen name="[feature]" options={{ title: 'ONE MORE' }} />
    </ThemedStack>
  );
}

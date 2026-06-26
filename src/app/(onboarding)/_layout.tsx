import { ThemedStack } from '@/components/layout/ThemedStack';

export default function OnboardingLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="legal" />
      <ThemedStack.Screen name="profile" />
    </ThemedStack>
  );
}

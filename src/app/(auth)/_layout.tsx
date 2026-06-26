import { ThemedStack } from '@/components/layout/ThemedStack';

export default function AuthLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="login" />
      <ThemedStack.Screen name="signup" />
      <ThemedStack.Screen name="forgot-password" />
      <ThemedStack.Screen name="reset-password" />
    </ThemedStack>
  );
}

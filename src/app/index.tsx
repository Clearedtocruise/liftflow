import { Redirect } from 'expo-router';

import { BrandBootScreen } from '@/components/brand/BrandBootScreen';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, isAuthenticated, isLoading, isProfileReady } = useAuth();

  if (isLoading) {
    return <BrandBootScreen />;
  }

  if (isAuthenticated) {
    if (isProfileReady && user && !user.onboardingCompleted) {
      return <Redirect href="/(onboarding)/legal" />;
    }
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/welcome" />;
}

import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, isAuthenticated, isLoading, isProfileHydrated } = useAuth();

  // Routing on the optimistic stub sent brand-new users to the dashboard for a frame before
  // bouncing them into onboarding, so hold the splash until the stored profile has loaded.
  if (isLoading || (isAuthenticated && !isProfileHydrated)) {
    return (
      <View style={styles.loading}>
        <LogoMark size={80} glow={false} animate={false} />
        <ActivityIndicator color={LiftFlowColors.primary} style={styles.spinner} />
      </View>
    );
  }

  if (isAuthenticated) {
    if (user && !user.onboardingCompleted) {
      return <Redirect href="/(onboarding)/legal" />;
    }
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  spinner: {
    marginTop: Spacing.xl,
  },
});

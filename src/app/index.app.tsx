import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { StaticLogoMark, StaticSplash } from '@/components/brand/StaticLogoMark';
import { MINIMAL_STARTUP, SMOKE_TEST, STRIP_NATIVE } from '@/config/startupFlags';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

function SmokeTestHome() {
  return (
    <View style={styles.smoke}>
      <StaticLogoMark size={80} />
      <Text style={styles.smokeTitle}>Smoke Test OK</Text>
      <Text style={styles.smokeBody}>Expo SDK 54 · React Native 0.81.5</Text>
      <Text style={styles.smokeHint}>
        If you see this screen, the shared EAS/TestFlight stack launches. ONE MORE app code is not on this path.
      </Text>
    </View>
  );
}

export default function AppIndex() {
  if (SMOKE_TEST) {
    return <SmokeTestHome />;
  }

  const { user, isAuthenticated, isLoading } = useAuth();

  if (STRIP_NATIVE) {
    if (isLoading) {
      return <StaticSplash />;
    }
    return <Redirect href="/(auth)/login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <LogoMark size={80} glow={false} animate={false} />
        <ActivityIndicator color={LiftFlowColors.primary} style={styles.spinner} />
      </View>
    );
  }

  if (MINIMAL_STARTUP) {
    return <Redirect href="/(auth)/login" />;
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
  smoke: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  smokeTitle: {
    color: '#0E90FF',
    fontSize: 28,
    fontWeight: '800',
  },
  smokeBody: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  smokeHint: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
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

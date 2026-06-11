import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { BootTestShell } from '@/components/observability/BootTestShell';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { diagnosticAtLeast } from '@/constants/diagnosticMode';
import { useAuth } from '@/hooks/useAuth';
import { forensicLog, forensicLogError } from '@/lib/forensicLog';

export default function Index() {
  if (!diagnosticAtLeast('supabase')) {
    return <BootTestShell />;
  }

  return <AuthenticatedIndex />;
}

function AuthenticatedIndex() {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    forensicLog('SUPABASE_INIT_START');
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      forensicLog('SUPABASE_INIT_SUCCESS', { userId: user.id });
    } else {
      forensicLog('SUPABASE_INIT_SUCCESS', { userId: null, authenticated: isAuthenticated });
    }
  }, [isLoading, user, isAuthenticated]);

  if (isLoading) {
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

export function logSupabaseInitFailure(error: unknown): void {
  forensicLogError('SUPABASE_INIT_FAIL', error);
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
